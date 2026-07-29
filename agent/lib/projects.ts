// 周报要扫描的本地 git 项目注册表。跨会话持久化到磁盘 JSON 文件
// (defineState 是会话内短期记忆,不适合这种用户长期维护的配置)。
//
// 默认存放在项目根目录的 projects.json;可用环境变量 WEEKLY_PROJECTS_FILE 覆盖。
// 用户既可以通过 add_project/remove_project 工具维护,也可以直接编辑该文件。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";

export interface Project {
  /** 报告里【项目名称】的展示名 */
  name: string;
  /** 本地 git 仓库绝对路径 */
  path: string;
}

interface Registry {
  projects: Project[];
}

const FILE = process.env.WEEKLY_PROJECTS_FILE
  ? resolve(process.env.WEEKLY_PROJECTS_FILE)
  : resolve(process.cwd(), "projects.json");

function isProject(v: unknown): v is Project {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Partial<Project>;
  return (
    typeof p.name === "string" &&
    p.name.trim() !== "" &&
    typeof p.path === "string" &&
    p.path.trim() !== ""
  );
}

function load(): Registry {
  if (!existsSync(FILE)) return { projects: [] };
  try {
    const raw = JSON.parse(readFileSync(FILE, "utf8"));
    if (raw && Array.isArray(raw.projects)) {
      return { projects: raw.projects.filter(isProject) };
    }
  } catch {
    // 损坏的 JSON 当作空注册表,不抛错以免阻塞工具
  }
  return { projects: [] };
}

function save(reg: Registry): void {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(reg, null, 2) + "\n", "utf8");
}

export function listProjects(): Project[] {
  return load().projects;
}

export function findProject(key: string): Project | undefined {
  return load().projects.find(
    (p) => p.name === key || resolve(p.path) === resolve(key),
  );
}

export function addProject(name: string, path: string): Project[] {
  const reg = load();
  const abs = resolve(path);
  if (reg.projects.some((p) => resolve(p.path) === abs)) {
    throw new Error(`项目已存在(路径相同):${abs}`);
  }
  if (reg.projects.some((p) => p.name === name)) {
    throw new Error(`项目名已存在:${name}`);
  }
  reg.projects.push({ name, path: abs });
  save(reg);
  return reg.projects;
}

export function removeProject(key: string): Project[] {
  const reg = load();
  reg.projects = reg.projects.filter(
    (p) => p.name !== key && resolve(p.path) !== resolve(key),
  );
  save(reg);
  return reg.projects;
}

/** 校验路径是否为有效的 git 工作区。 */
export function isGitRepo(path: string): boolean {
  try {
    const out = execFileSync(
      "git",
      ["-C", path, "rev-parse", "--is-inside-work-tree"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    return out === "true";
  } catch {
    return false;
  }
}
