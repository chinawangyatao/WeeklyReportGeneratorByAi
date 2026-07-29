import { defineTool } from "eve/tools";
import { z } from "zod";
import { basename, resolve } from "node:path";
import { findProject, listProjects } from "../lib/projects";
import { getAuthor, listCommits } from "../lib/git";
import { resolveWindow, todayISO } from "../lib/dates";

export default defineTool({
  description:
    "拉取本地 git 项目的提交记录,用于生成周报。默认扫描本周(本周一到今天),按各仓库 git config user.name 过滤作者。可指定单个项目,或省略 project 扫描全部已注册项目。返回每个项目的提交列表;无提交则为空数组。",
  inputSchema: z.object({
    project: z
      .string()
      .optional()
      .describe("项目名称或本地仓库路径;省略则扫描全部已注册项目"),
    range: z
      .enum(["this-week", "last-week", "last-7-days"])
      .optional()
      .describe("时间窗,默认 this-week"),
    since: z.string().optional().describe("ISO 日期 YYYY-MM-DD,覆盖 range 起始"),
    until: z.string().optional().describe("ISO 日期 YYYY-MM-DD,覆盖 range 结束"),
    author: z
      .string()
      .optional()
      .describe("提交作者过滤;默认取各仓库 git config user.name"),
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("每个仓库最多取多少条提交,默认 200"),
  }),
  async execute({ project, range, since, until, author, limit }) {
    const window =
      since || until
        ? { since: since ?? "1970-01-01", until: until ?? todayISO() }
        : resolveWindow(range ?? "this-week");

    let targets: { name: string; path: string }[];
    if (project) {
      const found = findProject(project);
      targets = found
        ? [found]
        : [{ name: basename(resolve(project)), path: resolve(project) }];
    } else {
      targets = listProjects();
    }

    if (targets.length === 0) {
      return {
        window,
        projects: [],
        note: "没有已注册项目。先用 add_project 添加,或传 project 指定一个本地仓库路径。",
      };
    }

    const results = [];
    for (const p of targets) {
      try {
        const effectiveAuthor = author ?? (await getAuthor(p.path));
        const commits = await listCommits({
          path: p.path,
          author: effectiveAuthor,
          window,
          limit,
        });
        results.push({
          name: p.name,
          path: p.path,
          author: effectiveAuthor ?? null,
          window,
          commits,
        });
      } catch (err) {
        results.push({
          name: p.name,
          path: p.path,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return { window, projects: results };
  },
});
