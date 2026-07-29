import { defineMcpClientConnection } from "eve/connections";

// 腾讯文档 MCP - Excel 表格服务(sheet.* 工具):读写单元格/区域、样式、合并、筛选、排序、查找、子表、图表等。
// Token 与 tencent-docs 共用,从 .env 的 TENCENT_DOCS_TOKEN 读取,以原始 Authorization 头发送。
export default defineMcpClientConnection({
  url: "https://docs.qq.com/api/v6/sheet/mcp",
  description:
    "腾讯文档 Excel 表格:读取/写入单元格与区域数据(sheet.get_cell_data / sheet.set_cell_value / sheet.set_range_value / sheet.set_range_value_by_csv),以及样式、合并、筛选、排序、查找、子表管理、图表、透视表、保护区域。用 file_id 或 file_url 标识文档,行列索引从 0 开始。",
  headers: {
    Authorization: () => process.env.TENCENT_DOCS_TOKEN ?? "",
  },
});
