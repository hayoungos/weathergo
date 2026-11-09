import { addDays, kstNow, type Ymd } from '../date';
import { buildDays } from './process';
import type { FcstItem, TripWeather } from './types';

// 공공데이터포털 · 기상청_단기예보 조회서비스
const ENDPOINT = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst';
const BASE_HOURS = [2, 5, 8, 11, 14, 17, 20, 23];
/** 발표 후 API 제공까지의 여유 (기상청 안내: 발표시각 + 10분 이후 제공) */
const AVAILABLE_AFTER_MIN = 10;
const PAGE_SIZE = 1000;

export class WeatherApiError extends Error {
  constructor(
    message: string,
    readonly kind: 'noKey' | 'network' | 'http' | 'api' | 'parse',
  ) {
    super(message);
  }
}

/** 지금 조회 가능한 가장 최근 발표 기준 (KST) */
export function latestBase(now: Date = new Date()): { baseDate: Ymd; baseTime: string } {
  const { ymd, hour, minute } = kstNow(now);
  const minutes = hour * 60 + minute;
  for (let i = BASE_HOURS.length - 1; i >= 0; i--) {
    if (minutes >= BASE_HOURS[i] * 60 + AVAILABLE_AFTER_MIN) {
      return { baseDate: ymd, baseTime: `${String(BASE_HOURS[i]).padStart(2, '0')}00` };
    }
  }
  return { baseDate: addDays(ymd, -1), baseTime: '2300' };
}

function serviceKey(): string {
  const key = process.env.EXPO_PUBLIC_KMA_SERVICE_KEY?.trim();
  if (!key) throw new WeatherApiError('인증키가 설정되지 않았어요. (.env의 EXPO_PUBLIC_KMA_SERVICE_KEY)', 'noKey');
  // 공공데이터포털의 Encoding 키(%포함)는 그대로, Decoding 키는 인코딩해서 사용
  return key.includes('%') ? key : encodeURIComponent(key);
}

type PageResult = { items: FcstItem[]; totalCount: number };

async function fetchPage(
  params: { nx: number; ny: number; baseDate: string; baseTime: string; pageNo: number },
  fetchImpl: typeof fetch,
): Promise<PageResult> {
  const qs =
    `serviceKey=${serviceKey()}` +
    `&pageNo=${params.pageNo}&numOfRows=${PAGE_SIZE}&dataType=JSON` +
    `&base_date=${params.baseDate}&base_time=${params.baseTime}&nx=${params.nx}&ny=${params.ny}`;

  let res: Response;
  try {
    res = await fetchImpl(`${ENDPOINT}?${qs}`);
  } catch {
    throw new WeatherApiError('네트워크에 연결할 수 없어요.', 'network');
  }
  const text = await res.text();
  if (!res.ok) throw new WeatherApiError(`서버 응답 오류 (${res.status})`, 'http');

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    // 인증키 오류 등은 JSON 요청에도 XML로 반환된다
    const reason = /<returnAuthMsg>([^<]+)</.exec(text)?.[1] ?? /<resultMsg>([^<]+)</.exec(text)?.[1];
    throw new WeatherApiError(reason ? `API 오류: ${reason}` : '응답을 해석할 수 없어요.', 'parse');
  }

  const header = json?.response?.header;
  const body = json?.response?.body;
  if (header?.resultCode === '03') return { items: [], totalCount: 0 }; // NO_DATA
  if (header?.resultCode !== '00') {
    throw new WeatherApiError(`API 오류: ${header?.resultMsg ?? '알 수 없음'}`, 'api');
  }
  const raw = body?.items?.item;
  const items: FcstItem[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return { items, totalCount: Number(body?.totalCount ?? items.length) };
}

/** 모든 페이지를 받은 뒤에 반환한다. */
export async function fetchVilageFcst(
  params: { nx: number; ny: number; baseDate: string; baseTime: string },
  fetchImpl: typeof fetch = fetch,
): Promise<FcstItem[]> {
  const first = await fetchPage({ ...params, pageNo: 1 }, fetchImpl);
  const all = [...first.items];
  const pages = Math.ceil(first.totalCount / PAGE_SIZE);
  for (let p = 2; p <= pages; p++) {
    const next = await fetchPage({ ...params, pageNo: p }, fetchImpl);
    all.push(...next.items);
  }
  if (all.length < first.totalCount) {
    throw new WeatherApiError(`일부 데이터만 수신했어요. (${all.length}/${first.totalCount})`, 'api');
  }
  return all;
}

/** 여행 정보로 날씨를 조회해 날짜별로 가공한다. 열 때마다 새로 호출(캐시 없음). */
export async function loadTripWeather(
  trip: { nx: number; ny: number; startDate: Ymd; endDate: Ymd },
  opts: { now?: Date; fetchImpl?: typeof fetch } = {},
): Promise<TripWeather> {
  const now = opts.now ?? new Date();
  const base = latestBase(now);
  const items = await fetchVilageFcst({ nx: trip.nx, ny: trip.ny, ...base }, opts.fetchImpl);
  return {
    ...base,
    fetchedAt: now.toISOString(),
    days: buildDays(items, { ...trip, ...base }),
  };
}
