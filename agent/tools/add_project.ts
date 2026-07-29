import { defineTool } from "eve/tools";
import { z } from "zod";
import { addProject, isGitRepo } from "../lib/projects";

export default defineTool({
  description:
    "新增一个本地 git 项目到周报扫描列表。会校验路径是有效的 git 仓库。返回更新后的全部项目列表。",
  inputSchema: z.object({
    name: z.string().min(1).describe("项目展示名,用于周报【项目名称】"),
    path: z.string().min(1).describe("本地 git 仓库的绝对路径"),
  }),
  async execute({ name, path }) {
    if (!isGitRepo(path)) {
      return { ok: false, error: `路径不是有效的 git 仓库:${path}` };
    }
    try {
      const projects = addProject(name.trim(), path);
      return { ok: true, projects };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
});
