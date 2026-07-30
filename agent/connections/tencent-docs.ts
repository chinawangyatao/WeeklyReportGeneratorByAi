import { defineMcpClientConnection } from "eve/connections";

// 腾讯文档 MCP - 通用文档服务。
// Token 从 .env 的 TENCENT_DOCS_TOKEN 读取,以原始 Authorization 头发送(非 Bearer)。
//
// 注意:该服务 203 个工具里有 114 个名字带点(如 manage.search_file、sheet.*、doc.*、
// smartsheet.*、ocr.*),eve 给的限定名 tencent-docs__manage.search_file 含 ".",
// 不符合模型工具名规则 ^[a-zA-Z0-9_-]+$,会导致 MODEL_CALL_FAILED。
// 所以用 tools.allow 只暴露名字干净、常用的工具。需要 PPT(slide_*)再加进白名单;
// Word/Excel 精细编辑走专用连接或专用工具(sheet.* 带点不能用)。
export default defineMcpClientConnection({
  url: "https://docs.qq.com/openapi/mcp",
  description:
    "腾讯文档(docs.qq.com):创建/读取在线文档。可用 create_smartcanvas_by_mdx 把周报写成智能文档,get_content 读取文档,以及空间/思维导图/流程图。注意:本连接不提供搜文件功能(搜文件工具名带点不可用),要操作某个文档请让用户提供链接。",
  headers: {
    Authorization: () => process.env.TENCENT_DOCS_TOKEN ?? "",
  },
  tools: {
    allow: [
      "create_smartcanvas_by_mdx",
      "get_content",
      "scrape_url",
      "scrape_progress",
      "create_mind_by_markdown",
      "create_flowchart_by_mermaid",
      "create_space",
      "query_space_list",
      "query_space_node",
      "create_space_node",
      "delete_space_node",
      "upload_image",
      "get_user_info",
      "report_unsupported_feature",
      "check_skill_update",
    ],
  },
});
