import { defineTool } from "eve/tools";
import { z } from "zod";
import { listProjects } from "../lib/projects";

export default defineTool({
  description: "列出所有已注册的本地 git 项目(用于周报扫描)。",
  inputSchema: z.object({}),
  async execute() {
    const projects = listProjects();
    return { projects, count: projects.length };
  },
});
