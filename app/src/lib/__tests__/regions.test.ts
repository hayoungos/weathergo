import { describe, expect, it } from 'vitest';
import { REGIONS, searchRegions } from '../regions';

describe('지역 검색 (시·군·구)', () => {
  it('강릉 → 강릉시(92,131)가 첫 결과', () => {
    expect(searchRegions('강릉')[0]).toMatchObject({ sigungu: '강릉시', sido: '강원특별자치도', nx: 92, ny: 131 });
  });
  it('구가 있는 시는 시 이름으로도, 구 이름으로도 검색된다', () => {
    expect(searchRegions('수원').map((r) => r.sigungu)).toContain('수원시 장안구');
    expect(searchRegions('장안구')[0].sigungu).toBe('수원시 장안구');
  });
  it('읍·면·동은 포함하지 않는다', () => {
    expect(REGIONS.every((r) => !/(읍|면|동)$/.test(r.sigungu) || r.sigungu.endsWith('구'))).toBe(true);
  });
  it('검색어가 비면 결과 없음', () => {
    expect(searchRegions('  ')).toEqual([]);
  });
});
