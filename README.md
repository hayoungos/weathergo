# WeatherGo — 여행 기간 날씨

여행지와 기간을 정하면 그 기간의 날짜별 날씨를 한 화면에서 보여주는 웹앱입니다.
기상청 단기예보(공공데이터포털) API를 사용합니다.

## 구성

| 경로 | 내용 |
| --- | --- |
| `trip-weather.html` | 앱 화면 전체 (홈 · 여행 추가 · 기간별 날씨). 여행 정보는 브라우저 localStorage에 저장 |
| `api/kma/[op].js` | Vercel 서버리스 함수. 기상청 API를 대신 호출하고 인증키를 붙임 |
| `server.mjs` | 로컬 실행용 서버 (위 함수와 같은 역할 + 정적 파일 제공) |
| `vercel.json` | 배포 설정 (서울 리전 `icn1`, `/` → `trip-weather.html`) |
| `env.example` | 인증키 설정 예시 |
| `PRD.md`, `data-spec.md`, `screens/` | 기획 문서·와이어프레임 |
| `app/` | Expo(React Native) 버전 |

## 인증키

인증키는 코드와 저장소에 넣지 않습니다.

- **로컬:** `env.example`을 `.env`로 복사하고 `KMA_SERVICE_KEY=`에 키를 넣습니다. `.env`는 `.gitignore`로 제외됩니다.
- **Vercel:** Project → Settings → Environment Variables 에 `KMA_SERVICE_KEY`를 추가합니다.

공공데이터포털의 Encoding 키(`%` 포함)와 Decoding 키 모두 사용할 수 있습니다.

## 로컬 실행

```bash
node server.mjs        # Node 18 이상
# → http://localhost:5173
```

## Vercel 배포

1. 이 저장소를 Vercel에서 Import (Framework Preset: Other, Build Command 없음)
2. Environment Variables에 `KMA_SERVICE_KEY` 추가 (Production · Preview)
3. Deploy

API 호출은 `/api/kma/getVilageFcst`(단기예보), `/api/kma/getUltraSrtNcst`(초단기실황)만 허용합니다.
