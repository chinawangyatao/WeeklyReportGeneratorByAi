import { defineMcpClientConnection } from "eve/connections";

// 腾讯文档 MCP - 通用文档服务(创建/搜索/读取/管理在线文档)。
// Token 从 .env 的 TENCENT_DOCS_TOKEN 读取,以原始 Authorization 头发送(非 Bearer)。
// 四个腾讯文档服务共用同一 Token;如需 PPT/Word/Excel 精细编辑,复制本文件改 url:
//   PPT   https://docs.qq.com/api/v6/slide/mcp
//   Word  https://docs.qq.com/api/v6/doc/mcp
//   Excel https://docs.qq.com/api/v6/sheet/mcp
export default defineMcpClientConnection({
  url: "https://docs.qq.com/openapi/mcp",
  description:
    "腾讯文档(docs.qq.com):创建/搜索/读取/管理在线文档,含智能文档、Word、Excel、PPT、思维导图、流程图、智能表格、收集表。可把周报写入腾讯文档。",
  headers: {
    Authorization: () => process.env.TENCENT_DOCS_TOKEN ?? "",
  },
});
