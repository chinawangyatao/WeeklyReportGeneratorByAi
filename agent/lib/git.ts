// 本地 git 仓库的只读访问:取作者、按时间窗+作者拉取提交。
// 全部用 execFile + 参数数组,不拼 shell,杜绝命令注入。

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolveWindow, type DateWindow } from "./dates";

const execFileP = promisify(execFile);

export interface Commit {
  hash: string;
  /** ISO 严格格式,如 2026-07-29T14:30:00+08:00 */
  date: string;
  author: string;
  subject: string;
}

/** 取仓库的 git config user.name;拿不到返回 undefined。 */
export async function getAuthor(path: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileP("git", ["-C", path, "config", "user.name"], {
      encoding: "utf8",
    });
    const name = stdout.trim();
    return name || undefined;
  } catch {
    return undefined;
  }
}

export async function listCommits(opts: {
  path: string;
  author?: string;
  window: DateWindow;
  limit?: number;
}): Promise<Commit[]> {
  const { path, author, window, limit = 200 } = opts;
  const args = [
    "-C",
    path,
    "-c",
    "core.quotepath=false",
    "log",
    "--no-merges",
    `--since=${window.since} 00:00:00`,
    `--until=${window.until} 23:59:59`,
    "--pretty=format:%h%x09%ad%x09%an%x09%s",
    "--date=iso-strict",
    "-n",
    String(limit),
  ];
  if (author) args.push(`--author=${author}`);

  try {
    const { stdout } = await execFileP("git", args, {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    const trimmed = stdout.trim();
    if (!trimmed) return [];
    return trimmed.split("\n").map((line) => {
      const [hash, date, author, ...rest] = line.split("\t");
      return {
        hash: hash ?? "",
        date: date ?? "",
        author: author ?? "",
        subject: rest.join("\t"),
      };
    });
  } catch (err) {
    throw new Error(
      `git log 失败(${path}):${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export { resolveWindow };
export type { DateWindow };
