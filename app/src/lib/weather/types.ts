import type { Ymd } from '../date';
import type { Condition } from './condition';

/** getVilageFcst 응답의 item 한 건 */
export type FcstItem = {
  baseDate: string;
  baseTime: string;
  category: string;
  fcstDate: string;
  fcstTime: string;
  fcstValue: string;
  nx: number;
  ny: number;
};

/** 한 예보 시각의 정보. 각 값은 없으면 null (0은 유효한 값). */
export type HourlyForecast = {
  time: string; // 'HHMM'
  tmp: number | null; // ℃
  sky: number | null;
  pty: number | null;
  pop: number | null; // %
  condition: Condition | null;
};

export type DayForecast = {
  date: Ymd;
  /** 해당 날짜에 TMP·SKY·PTY·POP·TMN·TMX 중 어떤 값도 없으면 false → '예보 미제공' */
  hasForecast: boolean;
  /** 낮 12시 대표 시각. 1200 데이터가 전혀 없으면 null */
  noon: HourlyForecast | null;
  tmn: number | null;
  tmx: number | null;
  /** 실제로 수신된 예보 시각만, 시간순 */
  hourly: HourlyForecast[];
};

export type TripWeather = {
  baseDate: string;
  baseTime: string;
  /** 앱의 마지막 성공 조회 시각 (ISO) — 발표 기준과 구분 */
  fetchedAt: string;
  days: DayForecast[];
};
