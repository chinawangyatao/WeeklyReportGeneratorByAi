import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  PLAN_FILE_ID,
  PLAN_SHEET_ID,
  getCellCsv,
  levenshtein,
  iterationCoversToday,
  todayMonthDot,
} from "../lib/tencent-sheet";

// 负责人所在的列:8=产品 9=后端 10=前端 11=测试
const ASSIGNEE_COLS = [8, 9, 10, 11];

function splitNames(cell: string): string[] {
  return cell
    .split(/[/／,，、\s]+/)
    .map((s) => s.trim())
    .filter((s) => s && s !== "/");
}

interface PlanItem {
  project: string;
  item: string;
  type: string;
  priority: string;
  iteration: string;
  status: string;
  is_current: boolean;
}

export default defineTool({
  description:
    "从腾讯文档迭代规划表(【智旅产品中心】迭代规划事项说明,最新-事项整理)读取本人当前两周迭代的计划事项,用于周报对照'计划 vs 实际'。负责人在 产品/后端/前端/测试 列,可能有谐音字:第一次调用若返回 needs_confirm,用 ask_question 让用户从 candidates 里确认名字,再带 confirm_name 重调。两周一迭代,会标记覆盖今天的迭代段为 is_current。",
  inputSchema: z.object({
    name: z.string().min(1).describe("你的名字(一般取 git config user.name)"),
    confirm_names: z
      .array(z.string())
      .optional()
      .describe("用户确认的名字列表(可含谐音/形近字);确认后用它精确过滤"),
  }),
  async execute({ name, confirm_names }) {
    // 读 ogt349 行1-315,列0-11(项目|事项描述|事项类型|优先级|_|迭代周期|_|状态|产品|后端|前端|测试)
    const rows = await getCellCsv(PLAN_FILE_ID, PLAN_SHEET_ID, 1, 0, 315, 11);
    const tmd = todayMonthDot();

    const items: Array<{ roles: string[] } & Omit<PlanItem, "is_current">> = [];
    const nameRows = new Map<string, number[]>();

    for (const cells of rows) {
      const project = (cells[0] ?? "").trim();
      const item = (cells[1] ?? "").trim();
      const type = (cells[2] ?? "").trim();
      const priority = (cells[3] ?? "").trim();
      const iteration = (cells[5] ?? "").trim();
      const status = (cells[7] ?? "").trim();
      const assignees = ASSIGNEE_COLS.flatMap((c) => splitNames(cells[c] ?? ""));
      if (!project && !item && assignees.length === 0) continue;
      const idx = items.length;
      items.push({ project, item, type, priority, iteration, status, roles: assignees });
      for (const n of new Set(assignees)) {
        if (!nameRows.has(n)) nameRows.set(n, []);
        nameRows.get(n)!.push(idx);
      }
    }

    const filterByNames = (targets: string[]): PlanItem[] =>
      items
        .filter((it) => it.roles.some((r) => targets.includes(r)))
        .map((it) => {
          const segs = it.iteration
            .split(/\n+/)
            .map((s) => s.trim())
            .filter(Boolean);
          return {
            project: it.project,
            item: it.item,
            type: it.type,
            priority: it.priority,
            iteration: it.iteration,
            status: it.status,
            is_current: segs.some((s) => iterationCoversToday(s, tmd)),
          };
        });

    if (confirm_names && confirm_names.length > 0) {
      const matched = filterByNames(confirm_names);
      return {
        names: confirm_names,
        count: matched.length,
        current_count: matched.filter((m) => m.is_current).length,
        items: matched,
      };
    }

    // 候选名字:精确 + 同长度且 levenshtein<=2(覆盖谐音/形近字,如 王煦澄/王煦成/王旭成)
    const allNames = [...nameRows.keys()];
    const exact = allNames.includes(name);
    const candidates = new Set<string>();
    if (exact) candidates.add(name);
    for (const n of allNames) {
      if (n.length === name.length && n !== name && levenshtein(name, n) <= 2) {
        candidates.add(n);
      }
    }
    const candList = [...candidates]
      .map((n) => ({ name: n, count: nameRows.get(n)!.length, distance: levenshtein(name, n) }))
      .sort((a, b) => a.distance - b.distance || b.count - a.count);

    // 精确命中且没有其它近似候选 -> 直接返回,不必问
    if (exact && candList.length === 1) {
      const matched = filterByNames([name]);
      return {
        names: [name],
        count: matched.length,
        current_count: matched.filter((m) => m.is_current).length,
        items: matched,
      };
    }

    return {
      needs_confirm: true,
      exact_found: exact,
      candidates: candList,
      hint: "迭代规划表里可能有谐音/形近字(distance 越小越像)。用 ask_question 让用户从 candidates 里确认哪个(或哪几个)是自己的名字,再带 confirm_names 重调本工具。也可让用户补充候选外的其它写法。",
    };
  },
});
