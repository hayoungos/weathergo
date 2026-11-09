import { describe, expect, it } from 'vitest';
import { addDays, dateRange, formatDayLabel, kstNow } from '../../date';
import { sampleTripDates, selectableDates, validateTripDraft } from '../../policy';
import { latestBase, loadTripWeather } from '../api';
import { resolveCondition } from '../condition';
import { buildDays, hourlySlots, parseNumber, pickHero } from '../process';
import type { FcstItem } from '../types';

// data-spec.md의 강릉(92,131) · 2026-11-07 14:00 발표분을 바탕으로 만든 픽스처
const BASE = { baseDate: '20261107', baseTime: '1400', nx: 92, ny: 131 };

function item(category: string, fcstDate: string, fcstTime: string, fcstValue: string, over: Partial<FcstItem> = {}): FcstItem {
  return { ...BASE, category, fcstDate, fcstTime, fcstValue, ...over };
}

function hourly(date: string, time: string, tmp: string, sky: string, pty: string, pop: string): FcstItem[] {
  return [item('TMP', date, time, tmp), item('SKY', date, time, sky), item('PTY', date, time, pty), item('POP', date, time, pop)];
}

const fixture: FcstItem[] = [
  // 11/07 15시~ (data-spec 시간대별 수신 결과)
  ...hourly('20261107', '1500', '11', '1', '0', '0'),
  ...hourly('20261107', '1600', '10', '1', '0', '0'),
  ...hourly('20261107', '1700', '7', '1', '0', '0'),
  // 11/08: 10·11시 비, 12시 그침 (data-spec 5장)
  ...hourly('20261108', '1000', '9', '4', '1', '60'),
  ...hourly('20261108', '1100', '10', '4', '1', '60'),
  ...hourly('20261108', '1200', '11', '4', '0', '30'),
  item('TMN', '20261108', '0600', '2.0'),
  item('TMX', '20261108', '1500', '11.0'),
  // 11/09, 11/10 (data-spec 4장 요약 표)
  ...hourly('20261109', '1200', '11', '3', '0', '20'),
  item('TMN', '20261109', '0600', '4.0'),
  item('TMX', '20261109', '1500', '12.0'),
  ...hourly('20261110', '1200', '12', '1', '0', '0'),
  item('TMN', '20261110', '0600', '2.0'),
  item('TMX', '20261110', '1500', '12.0'),
  // 다른 지역·다른 발표분은 섞이면 안 됨
  item('TMX', '20261109', '1500', '99', { nx: 60, ny: 127 }),
  item('TMP', '20261109', '1200', '-5', { baseTime: '1100' }),
];

const opts = { ...BASE, startDate: '20261107', endDate: '20261112' };

describe('buildDays', () => {
  const days = buildDays(fixture, opts);

  it('여행 기간의 모든 날짜를 만든다 (예보 없는 날짜도 유지)', () => {
    expect(days.map((d) => d.date)).toEqual(['20261107', '20261108', '20261109', '20261110', '20261111', '20261112']);
    expect(days[4].hasForecast).toBe(false);
    expect(days[5].hasForecast).toBe(false);
  });

  it('data-spec 4장의 날짜별 요약과 일치한다', () => {
    const summary = days.slice(1, 4).map((d) => [d.date, d.noon?.tmp, d.noon?.sky, d.noon?.pty, d.noon?.pop, d.tmn, d.tmx]);
    expect(summary).toEqual([
      ['20261108', 11, 4, 0, 30, 2, 11],
      ['20261109', 11, 3, 0, 20, 4, 12],
      ['20261110', 12, 1, 0, 0, 2, 12],
    ]);
  });

  it('12시 값과 TMN/TMX가 없는 날(11/07)은 미제공이지만 시간대별 예보는 유지한다', () => {
    const d = days[0];
    expect(d.hasForecast).toBe(true);
    expect(d.noon).toBeNull();
    expect(d.tmn).toBeNull();
    expect(d.tmx).toBeNull();
    expect(d.hourly.map((h) => h.time)).toEqual(['1500', '1600', '1700']);
  });

  it('최고·최저를 시간대 기온으로 대체하지 않는다', () => {
    expect(days[0].tmx).toBeNull(); // 시간대 최고 11℃가 있어도 null
  });

  it('POP 0은 유효한 값으로 유지한다', () => {
    expect(days[3].noon?.pop).toBe(0);
  });

  it('12시 상태를 하루 전체 날씨로 쓰지 않는다 — 시간대별 상태가 각각 다르다', () => {
    const conds = days[1].hourly.map((h) => h.condition);
    expect(conds).toEqual(['rain', 'rain', 'cloudy']);
  });

  it('상세 영역은 00~23시 24칸, 없는 시각은 빈 칸', () => {
    const slots = hourlySlots(days[1]);
    expect(slots).toHaveLength(24);
    expect(slots[0].tmp).toBeNull();
    expect(slots[12].tmp).toBe(11);
  });
});

describe('parseNumber', () => {
  it('결측과 0을 구분한다', () => {
    expect(parseNumber('0')).toBe(0);
    expect(parseNumber('2.0')).toBe(2);
    expect(parseNumber('-999')).toBeNull();
    expect(parseNumber('900')).toBeNull();
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('강수없음')).toBeNull();
  });
});

describe('resolveCondition', () => {
  it('강수가 있으면 강수 상태 우선', () => {
    expect(resolveCondition(1, 0)).toBe('clear');
    expect(resolveCondition(3, 0)).toBe('partlyCloudy');
    expect(resolveCondition(4, 0)).toBe('cloudy');
    expect(resolveCondition(1, 1)).toBe('rain');
    expect(resolveCondition(4, 2)).toBe('sleet');
    expect(resolveCondition(4, 3)).toBe('snow');
    expect(resolveCondition(3, 4)).toBe('shower');
  });
  it('해석 불가 시 null', () => {
    expect(resolveCondition(null, null)).toBeNull();
    expect(resolveCondition(1, null)).toBeNull();
    expect(resolveCondition(2, 0)).toBeNull();
  });
});

describe('latestBase (KST)', () => {
  const at = (iso: string) => latestBase(new Date(iso));
  it('발표 10분 후부터 해당 발표분을 사용한다', () => {
    expect(at('2026-11-09T05:09:00Z')).toEqual({ baseDate: '20261109', baseTime: '1100' }); // 14:09 KST
    expect(at('2026-11-09T05:10:00Z')).toEqual({ baseDate: '20261109', baseTime: '1400' }); // 14:10 KST
  });
  it('02:10 이전에는 전날 23시 발표분', () => {
    expect(at('2026-11-08T17:05:00Z')).toEqual({ baseDate: '20261108', baseTime: '2300' }); // 11/9 02:05 KST
  });
});

describe('날짜 정책', () => {
  const now = new Date('2026-11-09T05:54:00Z'); // 11/9 14:54 KST
  it('선택 가능 범위는 오늘~D+4', () => {
    expect(selectableDates(now)).toEqual(['20261109', '20261110', '20261111', '20261112', '20261113']);
  });
  it('Sample은 오늘부터 3일', () => {
    expect(sampleTripDates(now)).toEqual({ startDate: '20261109', endDate: '20261111' });
  });
  it('필수값·당일치기·범위 검증', () => {
    expect(validateTripDraft({ name: ' ', regionId: null, startDate: null, endDate: null }, now)).toHaveProperty('name');
    expect(validateTripDraft({ name: 'a', regionId: 'r', startDate: '20261110', endDate: '20261110' }, now)).toHaveProperty('endDate');
    expect(validateTripDraft({ name: 'a', regionId: 'r', startDate: '20261108', endDate: '20261110' }, now)).toHaveProperty('startDate');
    expect(validateTripDraft({ name: 'a', regionId: 'r', startDate: '20261109', endDate: '20261114' }, now)).toHaveProperty('endDate');
    expect(validateTripDraft({ name: 'a', regionId: 'r', startDate: '20261109', endDate: '20261113' }, now)).toEqual({});
  });
  it('날짜 표시', () => {
    expect(formatDayLabel('20261109')).toBe('11.9(월)');
    expect(kstNow(now)).toEqual({ ymd: '20261109', hour: 14, minute: 54 });
    expect(dateRange('20261130', addDays('20261130', 2))).toEqual(['20261130', '20261201', '20261202']);
  });
});

describe('pickHero', () => {
  const days = buildDays(fixture, opts);
  it('여행 전에는 첫날 낮 12시', () => {
    const h = pickHero({ days }, '20261108', '20261110', { ymd: '20261107', hour: 15 });
    expect(h).toMatchObject({ date: '20261108', basis: 'noon' });
    expect(h.hour?.tmp).toBe(11);
  });
  it('여행 중이면 오늘의 현재 이후 가장 가까운 예보', () => {
    const h = pickHero({ days }, '20261107', '20261110', { ymd: '20261107', hour: 14 });
    expect(h).toMatchObject({ date: '20261107', basis: 'now' });
    expect(h.hour?.time).toBe('1500');
  });
});

describe('loadTripWeather', () => {
  process.env.EXPO_PUBLIC_KMA_SERVICE_KEY = 'abc+/=';
  const now = new Date('2026-11-07T05:30:00Z'); // 14:30 KST

  it('여러 페이지를 모두 받은 뒤 가공한다', async () => {
    const urls: string[] = [];
    const fake = (async (url: string) => {
      urls.push(url);
      const page = Number(/pageNo=(\d+)/.exec(url)![1]);
      const chunk = page === 1 ? fixture.slice(0, 1000) : [];
      return new Response(JSON.stringify({ response: { header: { resultCode: '00', resultMsg: 'NORMAL_SERVICE' }, body: { items: { item: chunk }, totalCount: fixture.length } } }));
    }) as unknown as typeof fetch;
    const w = await loadTripWeather({ nx: 92, ny: 131, startDate: '20261108', endDate: '20261110' }, { now, fetchImpl: fake });
    expect(w.baseTime).toBe('1400');
    expect(w.days.map((d) => d.tmx)).toEqual([11, 12, 12]);
    expect(urls[0]).toContain('serviceKey=abc%2B%2F%3D');
    expect(urls[0]).toContain('nx=92&ny=131');
  });

  it('인증키 오류 XML 응답은 조회 실패로 처리한다', async () => {
    const fake = (async () =>
      new Response('<OpenAPI_ServiceResponse><cmmMsgHeader><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg></cmmMsgHeader></OpenAPI_ServiceResponse>')) as unknown as typeof fetch;
    await expect(loadTripWeather({ nx: 92, ny: 131, startDate: '20261108', endDate: '20261110' }, { now, fetchImpl: fake })).rejects.toThrow(
      'SERVICE_KEY_IS_NOT_REGISTERED_ERROR',
    );
  });

  it('네트워크 실패는 network 오류', async () => {
    const fake = (async () => {
      throw new TypeError('fail');
    }) as unknown as typeof fetch;
    await expect(loadTripWeather({ nx: 92, ny: 131, startDate: '20261108', endDate: '20261110' }, { now, fetchImpl: fake })).rejects.toMatchObject({ kind: 'network' });
  });
});
