// 周报扫描的时间窗计算。所有日期按本地时区,周以周一为起点。

export type Range = "this-week" | "last-week" | "last-7-days";

export interface DateWindow {
  /** 起始日期 YYYY-MM-DD(含) */
  since: string;
  /** 结束日期 YYYY-MM-DD(含) */
  until: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** 返回 d 所在周的周一(本地时间,0 点)。 */
function mondayOf(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay(); // 0=周日 .. 6=周六
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function resolveWindow(range: Range): DateWindow {
  const now = new Date();

  if (range === "last-7-days") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { since: toISODate(start), until: toISODate(now) };
  }

  const thisMon = mondayOf(now);

  if (range === "last-week") {
    const lastMon = new Date(thisMon);
    lastMon.setDate(lastMon.getDate() - 7);
    const lastSun = new Date(thisMon);
    lastSun.setDate(lastSun.getDate() - 1);
    return { since: toISODate(lastMon), until: toISODate(lastSun) };
  }

  // this-week(默认):本周一到今天
  return { since: toISODate(thisMon), until: toISODate(now) };
}
