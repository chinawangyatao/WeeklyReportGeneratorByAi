import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  HR_FILE_ID,
  getSheetInfo,
  getCellCsv,
  setRangeValue,
  insertRow,
  formatChineseDate,
  todayISO,
} from "../lib/tencent-sheet";

// 非人名公共工作表,不作为某人的表
const NON_PERSON = new Set(["人力看板", "部门运行状态", "任务_需求_风险", "人员模版"]);

export default defineTool({
  description:
    "把'今天的工作'写入腾讯文档人力管理表(【研发中心】人力管理)本人工作表的'每日工作'列(列3)。名字取 git config user.name,按工作表名精确匹配;找不到会返回候选工作表名,用 ask_question 让用户选后再带确认的名字重调。同一日期已有记录时:若内容为空直接写;非空则默认返回 needs_mode 让用户选 覆盖/追加/跳过,再带 mode 重调。新日期在表头下方插入新行(最新在上),并尽力更新看板'本日工作'。",
  inputSchema: z.object({
    name: z.string().min(1).describe("你的名字(取 git config user.name)"),
    work: z.string().min(1).describe("今日工作内容(可多行)"),
    date: z.string().optional().describe("日期 YYYY-MM-DD,默认今天"),
    mode: z
      .enum(["overwrite", "append"])
      .optional()
      .describe("今日记录已存在且非空时的处理:overwrite 覆盖 / append 追加;省略则返回 needs_mode 让用户选"),
  }),
  async execute({ name, work, date, mode }) {
    const iso = date?.trim() || todayISO();
    const cnDate = formatChineseDate(iso);

    // 1. 找工作表
    const sheets = await getSheetInfo(HR_FILE_ID);
    const matched = sheets.find((s) => s.sheet_name === name);
    if (!matched) {
      return {
        needs_worksheet: true,
        name,
        candidates: sheets
          .filter((s) => s.sheet_type === "worksheet" && !NON_PERSON.has(s.sheet_name))
          .map((s) => s.sheet_name),
        hint: "没找到与名字完全相同的工作表。用 ask_question 让用户从 candidates 里选自己的工作表(或纠正名字),再带确认的名字重调本工具。",
      };
    }
    const sheetId = matched.sheet_id;

    // 2. 读 rows 0-10 cols 0-5:定位表头行(序号|日期) + 看板是否含"本日工作"
    const head = await getCellCsv(HR_FILE_ID, sheetId, 0, 0, 10, 5);
    let headerRow = -1;
    for (let r = 0; r < head.length; r++) {
      if ((head[r][0] ?? "").includes("序号") && (head[r][1] ?? "").includes("日期")) {
        headerRow = r;
        break;
      }
    }
    if (headerRow < 0) return { error: `在工作表 ${name} 里找不到表头行(序号|日期)` };
    const kanbanHasDaily = (head[0]?.[3] ?? "").includes("本日工作");

    // 3. 找今天的行(列1 日期,中文格式);同时定位第一条记录(最新在上,新行插这里)
    const dates = await getCellCsv(HR_FILE_ID, sheetId, headerRow + 1, 1, headerRow + 60, 1);
    let todayRow = -1;
    let firstRecordRow = -1;
    for (let r = 0; r < dates.length; r++) {
      const d = (dates[r][0] ?? "").trim();
      if (d && firstRecordRow < 0) firstRecordRow = headerRow + 1 + r;
      if (d === cnDate) todayRow = headerRow + 1 + r;
    }

    // 看板"本日工作"= (1,3),best-effort
    const updateKanban = async (): Promise<void> => {
      if (!kanbanHasDaily) return;
      try {
        await setRangeValue(HR_FILE_ID, sheetId, [{ row: 1, col: 3, string_value: work }]);
      } catch {
        // 看板布局因人而异,失败不阻塞主写入
      }
    };

    if (todayRow >= 0) {
      const cur = await getCellCsv(HR_FILE_ID, sheetId, todayRow, 3, todayRow, 3);
      const existing = (cur[0]?.[0] ?? "").trim();
      if (!existing) {
        await setRangeValue(HR_FILE_ID, sheetId, [{ row: todayRow, col: 3, string_value: work }]);
        await updateKanban();
        return { worksheet: name, sheet_id: sheetId, row: todayRow, date: cnDate, action: "written" };
      }
      if (mode === "overwrite") {
        await setRangeValue(HR_FILE_ID, sheetId, [{ row: todayRow, col: 3, string_value: work }]);
        await updateKanban();
        return { worksheet: name, sheet_id: sheetId, row: todayRow, date: cnDate, action: "overwritten", existing_preview: existing.slice(0, 120) };
      }
      if (mode === "append") {
        await setRangeValue(HR_FILE_ID, sheetId, [{ row: todayRow, col: 3, string_value: `${existing}\n${work}` }]);
        await updateKanban();
        return { worksheet: name, sheet_id: sheetId, row: todayRow, date: cnDate, action: "appended", existing_preview: existing.slice(0, 120) };
      }
      return {
        needs_mode: true,
        worksheet: name,
        sheet_id: sheetId,
        row: todayRow,
        date: cnDate,
        existing,
        existing_preview: existing.slice(0, 200),
        hint: "今天已有记录且非空。用 ask_question 问用户:覆盖(overwrite)/追加(append)/跳过,再带 mode 重调本工具。",
      };
    }

    // 4. 新日期:在第一条记录处插入一行(最新在上;无记录则插表头下方),写日期(列1)+每日工作(列3)
    const newRow = firstRecordRow >= 0 ? firstRecordRow : headerRow + 1;
    await insertRow(HR_FILE_ID, sheetId, newRow, 1);
    await setRangeValue(HR_FILE_ID, sheetId, [
      { row: newRow, col: 1, string_value: cnDate },
      { row: newRow, col: 3, string_value: work },
    ]);
    await updateKanban();
    return { worksheet: name, sheet_id: sheetId, row: newRow, date: cnDate, action: "inserted" };
  },
});
