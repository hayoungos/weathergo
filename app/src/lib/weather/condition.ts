// SKY + PTY → 날씨 상태 해석 (서비스 매핑)
// 기상청 단기예보 코드
//   SKY: 1 맑음, 3 구름많음, 4 흐림
//   PTY: 0 없음, 1 비, 2 비/눈, 3 눈, 4 소나기
// 강수(PTY ≠ 0)가 있으면 강수 상태를 우선하고, 없으면 하늘 상태로 표현한다.

export type Condition = 'clear' | 'partlyCloudy' | 'cloudy' | 'rain' | 'sleet' | 'snow' | 'shower';

export const CONDITION_LABEL: Record<Condition, string> = {
  clear: '맑음',
  partlyCloudy: '구름많음',
  cloudy: '흐림',
  rain: '비',
  sleet: '비/눈',
  snow: '눈',
  shower: '소나기',
};

const PTY_MAP: Record<number, Condition | undefined> = { 1: 'rain', 2: 'sleet', 3: 'snow', 4: 'shower' };
const SKY_MAP: Record<number, Condition | undefined> = { 1: 'clear', 3: 'partlyCloudy', 4: 'cloudy' };

/** 해석할 수 없으면 null (화면에서 '예보 미제공') */
export function resolveCondition(sky: number | null, pty: number | null): Condition | null {
  if (pty !== null && pty !== 0) return PTY_MAP[pty] ?? null;
  if (pty === 0 && sky !== null) return SKY_MAP[sky] ?? null;
  // PTY가 없으면 강수 여부를 알 수 없으므로 하늘 상태만으로 단정하지 않는다.
  return null;
}
