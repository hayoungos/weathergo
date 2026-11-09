// 모든 날짜 계산은 한국 표준시(KST, UTC+9) 기준으로 한다.
// 기기 시간대와 무관하게 동작하도록 Date의 UTC getter만 사용한다.

export type Ymd = string; // 'YYYYMMDD'

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export type KstNow = { ymd: Ymd; hour: number; minute: number };

export function kstNow(now: Date = new Date()): KstNow {
  const k = new Date(now.getTime() + KST_OFFSET_MS);
  return {
    ymd: toYmd(k.getUTCFullYear(), k.getUTCMonth() + 1, k.getUTCDate()),
    hour: k.getUTCHours(),
    minute: k.getUTCMinutes(),
  };
}

function pad(n: number, len = 2) {
  return String(n).padStart(len, '0');
}

export function toYmd(y: number, m: number, d: number): Ymd {
  return `${pad(y, 4)}${pad(m)}${pad(d)}`;
}

function parts(ymd: Ymd) {
  return { y: Number(ymd.slice(0, 4)), m: Number(ymd.slice(4, 6)), d: Number(ymd.slice(6, 8)) };
}

function asUtc(ymd: Ymd) {
  const { y, m, d } = parts(ymd);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(ymd: Ymd, n: number): Ymd {
  const t = asUtc(ymd);
  t.setUTCDate(t.getUTCDate() + n);
  return toYmd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** start~end(포함) 사이의 모든 날짜. end < start면 빈 배열. */
export function dateRange(start: Ymd, end: Ymd): Ymd[] {
  const out: Ymd[] = [];
  for (let cur = start; cur <= end && out.length < 366; cur = addDays(cur, 1)) out.push(cur);
  return out;
}

export function weekday(ymd: Ymd): string {
  return WEEKDAYS[asUtc(ymd).getUTCDay()];
}

/** 11.9(월) */
export function formatDayLabel(ymd: Ymd): string {
  const { m, d } = parts(ymd);
  return `${m}.${d}(${weekday(ymd)})`;
}

/** 11.9 */
export function formatMd(ymd: Ymd): string {
  const { m, d } = parts(ymd);
  return `${m}.${d}`;
}

/** 2026.11.09 */
export function formatYmdDots(ymd: Ymd): string {
  return `${ymd.slice(0, 4)}.${ymd.slice(4, 6)}.${ymd.slice(6, 8)}`;
}

/** '1500' → '15시' */
export function formatHourLabel(hhmm: string): string {
  return `${Number(hhmm.slice(0, 2))}시`;
}

/** '1400' → '14:00' */
export function formatHhmm(hhmm: string): string {
  return `${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}`;
}

export function hourToHhmm(hour: number): string {
  return `${pad(hour)}00`;
}
