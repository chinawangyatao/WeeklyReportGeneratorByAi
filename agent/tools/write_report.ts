import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default defineTool({
  description:
    "把生成的周报写入 reports/ 目录下的 Markdown 文件。默认文件名 周报-YYYY-MM-DD.md。每次写入前都需要用户确认(y/n)。",
  inputSchema: z.object({
    content: z.string().min(1).describe("周报 Markdown 全文"),
    filename: z.string().optional().describe("文件名,默认 周报-YYYY-MM-DD.md"),
  }),
  approval: always(),
  async execute({ content, filename }) {
    const name = filename?.trim() || `周报-${todayISO()}.md`;
    const dir = resolve(process.cwd(), "reports");
    mkdirSync(dir, { recursive: true });
    const file = resolve(dir, name);
    writeFileSync(file, content, "utf8");
    return { path: file, bytes: Buffer.byteLength(content, "utf8") };
  },
});
