// 腾讯文档 sheet MCP 客户端:直接 HTTP JSON-RPC 调用 sheet endpoint。
// 周报流程专用工具用这个 lib,不走 eve 的 MCP 连接(连接给模型做临时 Excel 操作用)。

import { todayISO } from "./dates";

const SHEET_EP = "https://docs.qq.com/api/v6/sheet/mcp";

// 固定的两张表
export const HR_FILE_ID = "DUExWSVNLSG5Id3ZW"; // 人力管理(每人一个工作表,写每日工作)
export const PLAN_FILE_ID = "DREFpYWZTRE94U1ZY"; // 迭代规划
export const PLAN_SHEET_ID = "ogt349"; // 最新-事项整理

let sessionId: string | null = null;
let idCounter = 0;

function getToken(): string {
  return process.env.TENCENT_DOCS_TOKEN ?? "";
}

function reqHeaders(): Record<string, string> {
  return {
    Authorization: getToken(),
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
  };
}

function parseResponse(text: string): unknown {
  const t = text.trim();
  if (t.startsWith("data:") || t.startsWith("event:")) {
    const lines = text.split("\n").filter((l) => l.startsWith("data:"));
    if (lines.length) return JSON.parse(lines[lines.length - 1].slice(5).trim());
  }
  return JSON.parse(t);
}

async function rpc(method: string, params: unknown, isNotify = false): Promise<any> {
  const body = isNotify
    ? JSON.stringify({ jsonrpc: "2.0", method })
    : JSON.stringify({ jsonrpc: "2.0", id: ++idCounter, method, params });
  const res = await fetch(SHEET_EP, { method: "POST", headers: reqHeaders(), body });
  const sid = res.headers.get("mcp-session-id");
  if (sid) sessionId = sid;
  if (isNotify) {
    // 通知(如 notifications/initialized)通常返回空 body(HTTP 202),不必解析
    await res.text();
    return null;
  }
  return parseResponse(await res.text()) as any;
}

async function ensureInit(): Promise<void> {
  await rpc("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "my-agent", version: "1.0" },
  });
  await rpc("notifications/initialized", null, true);
}

/**
 * 调用一个 sheet 工具,返回解析后的 data(自动解开 MCP content[0].text 的二次 JSON)。
 */
export async function callSheet(
  tool: string,
  args: Record<string, unknown>,
): Promise<any> {
  await ensureInit();
  const r = await rpc("tools/call", { name: tool, arguments: args });
  if (r?.error) throw new Error(`腾讯文档 ${tool} 失败: ${JSON.stringify(r.error)}`);
  const text = r?.result?.content?.[0]?.text;
  try {
    return typeof text === "string" ? JSON.parse(text) : text;
  } catch {
    return text;
  }
}

export interface SubSheet {
  sheet_id: string;
  sheet_name: string;
  sheet_type: string;
  row_count: number;
  col_count: number;
}

export async function getSheetInfo(fileId: string): Promise<SubSheet[]> {
  const r = await callSheet("get_sheet_info", { file_id: fileId });
  return (r?.sheets ?? []) as SubSheet[];
}

/**
 * 读区域,返回二维数组(已按腾讯 CSV 规则解析:逗号分隔,引号包裹可含换行)。
 */
export async function getCellCsv(
  fileId: string,
  sheetId: string,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
): Promise<string[][]> {
  const r = await callSheet("get_cell_data", {
    file_id: fileId,
    sheet_id: sheetId,
    start_row: startRow,
    start_col: startCol,
    end_row: endRow,
    end_col: endCol,
    return_csv: true,
  });
  return parseCsv(r?.csv_data ?? "");
}

/** 批量写单元格。values 用相对该 sheet 的全局行列索引(0-based)。 */
export async function setRangeValue(
  fileId: string,
  sheetId: string,
  values: Array<{ row: number; col: number; value_type?: string; string_value?: string }>,
): Promise<unknown> {
  return callSheet("set_range_value", {
    file_id: fileId,
    sheet_id: sheetId,
    values: values.map((v) => ({
      row: v.row,
      col: v.col,
      value_type: v.value_type ?? "STRING",
      string_value: v.string_value ?? "",
    })),
  });
}

/** 在 index 处插入行(direction before,新行落到 index 位置,原行下移)。 */
export async function insertRow(
  fileId: string,
  sheetId: string,
  index: number,
  count = 1,
): Promise<unknown> {
  return callSheet("insert_dimension", {
    file_id: fileId,
    sheet_id: sheetId,
    dimension_type: "row",
    index,
    count,
    direction: "before",
  });
}

/** 解析腾讯 CSV:逗号分隔,双引号包裹字段可含换行和转义引号 ""。 */
function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < csv.length) {
    const ch = csv[i];
    if (inQuotes) {
      if (ch === '"') {
        if (csv[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Levenshtein 编辑距离。 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] =
        a[i - 1] === b[j - 1]
          ? prev[j - 1]
          : Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + 1);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

/** ISO 日期(YYYY-MM-DD)-> 中文日期 "2026年7月29日"(月/日无前导零)。 */
export function formatChineseDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[1]}年${Number(m[2])}月${Number(m[3])}日`;
}

/** 把"7.27~8.7"这类迭代段与今天(月.日)比较,判断今天是否落在该段内。 */
export function iterationCoversToday(segment: string, todayMonthDot: number): boolean {
  // segment 形如 "7.27~8.7" 或 "7.27～8.7"
  const parts = segment.split(/[~～－-]/).map((s) => s.trim());
  if (parts.length !== 2) return false;
  const toMd = (s: string): number | null => {
    const mm = s.match(/^(\d{1,2})\.(\d{1,2})$/);
    return mm ? Number(mm[1]) * 100 + Number(mm[2]) : null;
  };
  const start = toMd(parts[0]);
  const end = toMd(parts[1]);
  if (start === null || end === null) return false;
  return todayMonthDot >= start && todayMonthDot <= end;
}

/** 今天月.日 -> 729 这种整数(7月29日=729)。 */
export function todayMonthDot(): number {
  const iso = todayISO();
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return 0;
  return Number(m[2]) * 100 + Number(m[3]);
}

export { todayISO };
