import data from '../data/regions.json';

export type Region = {
  id: string; // 행정구역코드
  sido: string; // 상위 행정구역 (예: 강원특별자치도)
  sigungu: string; // 시·군·구 (예: 강릉시)
  nx: number;
  ny: number;
};

export const REGIONS: Region[] = data as Region[];

const SIDO_SHORT: Record<string, string> = {
  서울특별시: '서울',
  부산광역시: '부산',
  대구광역시: '대구',
  인천광역시: '인천',
  광주광역시: '광주',
  전남광주통합특별시: '전남광주',
  대전광역시: '대전',
  울산광역시: '울산',
  세종특별자치시: '세종',
  경기도: '경기',
  강원특별자치도: '강원',
  충청북도: '충북',
  충청남도: '충남',
  전북특별자치도: '전북',
  전라남도: '전남',
  경상북도: '경북',
  경상남도: '경남',
  제주특별자치도: '제주',
};

export function sidoShort(sido: string): string {
  return SIDO_SHORT[sido] ?? sido;
}

const strip = (s: string) => s.replace(/\s+/g, '');
/** '강릉시' → '강릉', '양양군' → '양양' (접미사 없이도 검색되도록) */
const stem = (s: string) => s.replace(/(특별자치시|특별자치도|특별시|광역시|시|군|구|도)$/, '');

/**
 * 시·군·구 검색. 시·군·구 이름 앞부분 일치 → 포함 → 상위 행정구역 일치 순.
 */
export function searchRegions(query: string, limit = 8): Region[] {
  const q = strip(query);
  if (!q) return [];
  const scored: { r: Region; score: number }[] = [];
  for (const r of REGIONS) {
    const name = strip(r.sigungu);
    const full = strip(r.sido + r.sigungu);
    const shortFull = strip(sidoShort(r.sido) + r.sigungu);
    let score = -1;
    if (name === q || stem(name) === q) score = 0;
    else if (name.startsWith(q)) score = 1;
    else if (name.includes(q)) score = 2;
    else if (full.includes(q) || shortFull.includes(q)) score = 3;
    else if (r.sido.startsWith(q) || sidoShort(r.sido) === q) score = 4;
    if (score >= 0) scored.push({ r, score });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.r.sigungu.localeCompare(b.r.sigungu, 'ko'))
    .slice(0, limit)
    .map((x) => x.r);
}

export function findRegion(id: string): Region | undefined {
  return REGIONS.find((r) => r.id === id);
}

export const SAMPLE_REGION: Region =
  REGIONS.find((r) => r.sigungu === '강릉시') ?? { id: '5115000000', sido: '강원특별자치도', sigungu: '강릉시', nx: 92, ny: 131 };
