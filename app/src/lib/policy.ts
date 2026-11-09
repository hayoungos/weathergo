import { addDays, dateRange, kstNow, type Ymd } from './date';

/** 단기예보 제공 범위에 맞춘 여행 날짜 선택 정책 (사용자 결정: 오늘~D+4, 최대 5일, 당일치기 불가) */
export const MAX_DAYS_AHEAD = 4;
export const MAX_TRIP_DAYS = 5;
export const MIN_TRIP_DAYS = 2;

/** 날짜별 요약의 대표 시각 (사용자 결정: 낮 12시) */
export const REPRESENTATIVE_TIME = '1200';

/** 여행 추가 화면에서 고를 수 있는 날짜 목록 */
export function selectableDates(now: Date = new Date()): Ymd[] {
  const today = kstNow(now).ymd;
  return dateRange(today, addDays(today, MAX_DAYS_AHEAD));
}

/** Sample 여행 기간: 실행 시점 기준 오늘부터 3일 */
export function sampleTripDates(now: Date = new Date()): { startDate: Ymd; endDate: Ymd } {
  const today = kstNow(now).ymd;
  return { startDate: today, endDate: addDays(today, 2) };
}

export type TripDraft = {
  name: string;
  regionId: string | null;
  startDate: Ymd | null;
  endDate: Ymd | null;
};

export type TripDraftErrors = Partial<Record<'name' | 'region' | 'startDate' | 'endDate', string>>;

export function validateTripDraft(draft: TripDraft, now: Date = new Date()): TripDraftErrors {
  const errors: TripDraftErrors = {};
  const allowed = selectableDates(now);
  const first = allowed[0];
  const last = allowed[allowed.length - 1];

  if (!draft.name.trim()) errors.name = '여행 이름을 입력해 주세요.';
  if (!draft.regionId) errors.region = '여행지를 검색해서 선택해 주세요.';

  if (!draft.startDate) {
    errors.startDate = '가는 날을 선택해 주세요.';
  } else if (draft.startDate < first || draft.startDate > last) {
    errors.startDate = '가는 날은 오늘부터 4일 뒤까지 선택할 수 있어요.';
  }

  if (!draft.endDate) {
    errors.endDate = '오는 날을 선택해 주세요.';
  } else if (draft.startDate && draft.endDate <= draft.startDate) {
    errors.endDate = '오는 날은 가는 날 이후로 선택해 주세요. (당일치기 불가)';
  } else if (draft.endDate > last) {
    errors.endDate = '오는 날은 오늘부터 4일 뒤까지 선택할 수 있어요.';
  }
  return errors;
}
