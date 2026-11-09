# 여행 날씨 (weather-travel)

여행지와 여행 기간을 설정하면 기간의 날짜별 날씨를 한 화면에서 비교하는 모바일 앱 (Expo SDK 58 · TypeScript · Expo Router).
기획: `../PRD.md`, `../data-spec.md`

## 실행

1. 의존성 설치 — `npm install`
2. 인증키 설정 — `.env.example`을 `.env`로 복사하고 공공데이터포털 **기상청_단기예보 조회서비스** 인증키를 넣는다.
   ```
   EXPO_PUBLIC_KMA_SERVICE_KEY=발급받은_Decoding_키
   ```
   Encoding 키(`%` 포함)를 넣어도 동작한다. `.env`는 git에 올라가지 않는다.
3. 실행 — `npx expo start` → 휴대폰의 **Expo Go** 앱으로 QR 코드를 스캔.
   `.env`를 바꾼 뒤에는 `npx expo start --clear`로 다시 시작한다.

## 명령어

| 명령 | 내용 |
| --- | --- |
| `npm test` | 데이터 가공·정책·지역 검색 단위 테스트 (vitest) |
| `npm run typecheck` | 타입 검사 |
| `python3 scripts/build_regions.py <격자엑셀.xlsx>` | 기상청 격자 엑셀 → `src/data/regions.json` (시·군·구 256개) |

## 구조

```
src/
  app/                 화면 (Expo Router)
    index.tsx          SCR-MAIN-01 홈: 여행 목록
    add.tsx            MOD-MAIN-01 여행 추가
    trip/[id].tsx      SCR-MAIN-02 기간별 날씨 + 날짜별 아코디언
  components/          아이콘 세트(WeatherIcon), 테마, 표시 형식
  lib/
    date.ts            KST 날짜 계산
    policy.ts          날짜 선택 범위·Sample 기간·입력 검증
    regions.ts         지역 검색
    trips.ts           기기 내 여행 저장 (AsyncStorage)
    weather/
      api.ts           getVilageFcst 호출 (발표시각 계산, 전체 페이지 수신)
      process.ts       날짜별 요약·시간대별 가공, 상단 영역 선택
      condition.ts     SKY+PTY → 날씨 상태
  data/regions.json    시·군·구 격자 좌표 (2607 엑셀, 2026-07-01 업데이트분)
```

## 확정된 정책

- 대표 시각: 날짜별 요약의 기온·날씨·강수확률은 **낮 12시** 예보. 최고·최저는 해당 날짜의 TMX·TMN.
- 날짜 선택: **오늘~4일 뒤**, 최소 2일(당일치기 불가), 최대 5일.
- Sample 여행: 강릉, **실행 시점 기준 오늘부터 3일** (날짜를 저장하지 않고 매번 계산).
- 상단 영역: 기본은 여행 첫날 낮 12시. 오늘이 여행 기간에 포함되면 오늘 현재 시각 이후 가장 가까운 예보.
- 시간대별 상세: 00~23시 1시간 간격 24칸. 수신되지 않은 시각은 '예보 미제공'.
- 갱신: 캐시 없이 화면을 열 때마다 다시 조회 (당겨서 새로고침 가능).
- 미제공·실패: 값 0과 미제공을 구분. TMN·TMX가 없으면 '미제공' (시간대 기온으로 대체하지 않음). API 실패는 '조회 실패'로 별도 표시.
- 지역: 시·군·구 단위, 검색 결과에 상위 행정구역 표시. 인증키는 앱에서 직접 호출(MVP).
