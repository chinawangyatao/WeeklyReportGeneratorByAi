import { defineTool } from "eve/tools";
import { z } from "zod";
import { removeProject } from "../lib/projects";

export default defineTool({
  description:
    "从周报扫描列表中删除一个项目(按名称或路径匹配)。返回更新后的全部项目列表。",
  inputSchema: z.object({
    name: z.string().optional().describe("要删除的项目名称"),
    path: z.string().optional().describe("要删除的项目路径"),
  }),
  async execute({ name, path }) {
    const key = name ?? path;
    if (!key) {
      return { ok: false, error: "请提供 name 或 path 之一" };
    }
    const projects = removeProject(key);
    return { ok: true, projects };
  },
});
