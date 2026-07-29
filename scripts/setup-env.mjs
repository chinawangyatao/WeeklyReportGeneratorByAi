#!/usr/bin/env node
// 交互式引导用户配置 API key,写入项目根目录的 .env(已 gitignore)。
// 用法: npm run setup

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const envPath = fileURLToPath(new URL("../.env", import.meta.url));

// 要配置的 key 列表
const KEYS = [
  {
    name: "DEEPSEEK_API_KEY",
    label: "DeepSeek API key",
    help: "获取: https://platform.deepseek.com/api_keys",
    required: true,
  },
  {
    name: "TENCENT_DOCS_TOKEN",
    label: "腾讯文档 Token",
    help: "获取: https://docs.qq.com/scenario/open-claw.html (可选,留空跳过)",
    required: false,
  },
];

function readLines() {
  return existsSync(envPath) ? readFileSync(envPath, "utf8").split("\n") : [];
}

function getValue(lines, name) {
  for (const line of lines) {
    const m = line.match(new RegExp(`^${name}=(.*)$`));
    if (m) return m[1].trim();
  }
  return "";
}

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });
  let lines = readLines();
  const values = {};

  console.log("API key 配置(回车保留当前值)\n");
  for (const k of KEYS) {
    console.log(k.help);
    const cur = getValue(lines, k.name);
    const prompt = cur
      ? `${k.label}(回车保留当前值): `
      : `${k.label}${k.required ? "" : "(可选)"}: `;
    const input = (await rl.question(prompt)).trim();
    values[k.name] = input || cur;
    if (!values[k.name] && k.required) {
      console.log(`  ⚠️ 未提供 ${k.name},可稍后重新运行 npm run setup 或手动编辑 .env`);
    }
  }

  // 写回:更新已存在的行,追加缺失的,保留其它行(注释/其它 key)
  for (const k of KEYS) {
    const re = new RegExp(`^${k.name}=.*$`);
    const idx = lines.findIndex((l) => re.test(l));
    const newline = `${k.name}=${values[k.name]}`;
    if (idx >= 0) lines[idx] = newline;
    else lines.push(newline);
  }
  writeFileSync(envPath, lines.join("\n").replace(/\n+$/, "\n"), "utf8");
  console.log(`\n已写入 ${envPath}`);
  console.log("现在可以运行: npm run dev");
  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
