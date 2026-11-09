import { dateRange, hourToHhmm, type Ymd } from '../date';
import { REPRESENTATIVE_TIME } from '../policy';
import { resolveCondition } from './condition';
import type { DayForecast, FcstItem, HourlyForecast, TripWeather } from './types';

const HOURLY_CATEGORIES = ['TMP', 'SKY', 'PTY', 'POP'] as const;

/**
 * 기상청 결측값(±900 이상)·숫자 아닌 값은 null.
 * '0'은 유효한 값으로 유지한다 (예: POP 0%).
 */
export function parseNumber(raw: string | undefined | null): number | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (n >= 900 || n <= -900) return null;
  return n;
}

function emptyHour(time: string): HourlyForecast {
  return { time, tmp: null, sky: null, pty: null, pop: null, condition: null };
}

/**
 * 원본 예보 항목을 여행 기간의 날짜별 데이터로 가공한다.
 * - 여행 기간의 모든 날짜를 먼저 만들고 데이터를 연결한다 (예보 없는 날짜도 사라지지 않음).
 * - 같은 지역(nx, ny)·같은 발표 기준의 항목만 사용한다.
 * - TMN·TMX는 12시 행에서 찾지 않고 같은 날짜의 일별 항목에서 결합한다.
 * - 시간대 기온으로 최고·최저를 대체하지 않는다.
 */
export function buildDays(
  items: FcstItem[],
  opts: { startDate: Ymd; endDate: Ymd; nx: number; ny: number; baseDate: string; baseTime: string },
): DayForecast[] {
  const scoped = items.filter(
    (it) =>
      Number(it.nx) === opts.nx &&
      Number(it.ny) === opts.ny &&
      it.baseDate === opts.baseDate &&
      it.baseTime === opts.baseTime,
  );

  // date → time → hour
  const hours = new Map<string, Map<string, HourlyForecast>>();
  const tmn = new Map<string, number | null>();
  const tmx = new Map<string, number | null>();
  const seenDates = new Set<string>();

  for (const it of scoped) {
    const cat = it.category;
    if (cat === 'TMN' || cat === 'TMX') {
      seenDates.add(it.fcstDate);
      (cat === 'TMN' ? tmn : tmx).set(it.fcstDate, parseNumber(it.fcstValue));
      continue;
    }
    if (!(HOURLY_CATEGORIES as readonly string[]).includes(cat)) continue;
    seenDates.add(it.fcstDate);
    let byTime = hours.get(it.fcstDate);
    if (!byTime) hours.set(it.fcstDate, (byTime = new Map()));
    let h = byTime.get(it.fcstTime);
    if (!h) byTime.set(it.fcstTime, (h = emptyHour(it.fcstTime)));
    const v = parseNumber(it.fcstValue);
    if (cat === 'TMP') h.tmp = v;
    else if (cat === 'SKY') h.sky = v;
    else if (cat === 'PTY') h.pty = v;
    else if (cat === 'POP') h.pop = v;
  }

  return dateRange(opts.startDate, opts.endDate).map((date) => {
    const byTime = hours.get(date);
    const hourly = byTime
      ? [...byTime.values()].sort((a, b) => a.time.localeCompare(b.time))
      : [];
    for (const h of hourly) h.condition = resolveCondition(h.sky, h.pty);
    return {
      date,
      hasForecast: seenDates.has(date),
      noon: byTime?.get(REPRESENTATIVE_TIME) ?? null,
      tmn: tmn.get(date) ?? null,
      tmx: tmx.get(date) ?? null,
      hourly,
    };
  });
}

/**
 * 상세 아코디언용 24칸(00시~23시, 1시간 간격).
 * 수신되지 않은 시각은 값이 모두 null인 칸으로 채워 '예보 미제공'을 표시한다.
 */
export function hourlySlots(day: DayForecast): HourlyForecast[] {
  const byTime = new Map(day.hourly.map((h) => [h.time, h]));
  return Array.from({ length: 24 }, (_, hr) => byTime.get(hourToHhmm(hr)) ?? emptyHour(hourToHhmm(hr)));
}

export function isEmptyHour(h: HourlyForecast): boolean {
  return h.tmp === null && h.sky === null && h.pty === null && h.pop === null;
}

export type HeroInfo = {
  date: Ymd;
  /** 'noon' = 여행 첫날 낮 12시, 'now' = 여행 중인 오늘의 가장 가까운 예보 시각 */
  basis: 'noon' | 'now';
  hour: HourlyForecast | null;
};

/**
 * 상세 화면 상단 영역.
 * 기본은 여행 첫날 낮 12시. 오늘이 여행 기간에 포함되면 오늘의 현재 시각 이후 가장 가까운 예보.
 */
export function pickHero(weather: Pick<TripWeather, 'days'> | null, startDate: Ymd, endDate: Ymd, now: { ymd: Ymd; hour: number }): HeroInfo {
  const inTrip = now.ymd >= startDate && now.ymd <= endDate;
  if (inTrip) {
    const today = weather?.days.find((d) => d.date === now.ymd);
    const current = hourToHhmm(now.hour);
    const next = today?.hourly.find((h) => h.time >= current && !isEmptyHour(h)) ?? null;
    return { date: now.ymd, basis: 'now', hour: next };
  }
  const first = weather?.days.find((d) => d.date === startDate);
  return { date: startDate, basis: 'noon', hour: first?.noon ?? null };
}
