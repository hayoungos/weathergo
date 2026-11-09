import { CONDITION_LABEL, type Condition } from '@/lib/weather/condition';

export const NA = '예보 미제공';

export function fmtTemp(v: number | null): string {
  return v === null ? NA : `${Math.round(v)}℃`;
}

export function fmtPop(v: number | null): string {
  return v === null ? NA : `${v}%`;
}

export function fmtCondition(c: Condition | null): string {
  return c === null ? NA : CONDITION_LABEL[c];
}
