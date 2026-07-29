#!/usr/bin/env node
// 交互式引导用户配置 DeepSeek API key,写入项目根目录的 .env(已 gitignore)。
// 用法: npm run setup

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const envPath = fileURLToPath(new URL("../.env", import.meta.url));

function currentKey() {
  if (!existsSync(envPath)) return "";
  const m = readFileSync(envPath, "utf8").match(/^DEEPSEEK_API_KEY=(.*)$/m);
  return m ? m[1].trim() : "";
}

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });
  const has = currentKey();

  console.log("DeepSeek API key 配置");
  console.log("获取 key: https://platform.deepseek.com/api_keys\n");

  const prompt = has
    ? "请输入 DEEPSEEK_API_KEY(回车保留当前值): "
    : "请输入 DEEPSEEK_API_KEY: ";
  const input = (await rl.question(prompt)).trim();
  const value = input || has;

  if (!value) {
    console.log("\n未提供 key,已跳过。可稍后重新运行 npm run setup,或手动编辑 .env。");
    rl.close();
    return;
  }

  writeFileSync(envPath, `DEEPSEEK_API_KEY=${value}\n`, "utf8");
  console.log(`\n已写入 ${envPath}`);
  console.log("现在可以运行: npm run dev");
  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
