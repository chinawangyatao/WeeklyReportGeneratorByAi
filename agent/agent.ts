import { defineAgent } from "eve";
import {createDeepSeek} from "@ai-sdk/deepseek";


// DeepSeek API key 从环境变量读取;本地放在 .env,由 `npm run dev` / `npm run start`
// 脚本里的 --env-file-if-exists=.env 自动加载。不在这里 throw:eve build 也会执行
// 本模块,运行时密钥不应阻塞构建。缺少 key 时构建仍通过,运行时首次调用模型会
// 收到 DeepSeek 鉴权错误。配置方式:`npm run setup`(交互式)或复制 .env.example 为 .env。
const DeepSeek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY ?? "",
  baseURL: "https://api.deepseek.com",
});


export default defineAgent({
  model:DeepSeek('deepseek-v4-pro'),
});


