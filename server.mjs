// WeatherGo 로컬 서버
// - trip-weather.html·로고 등 이 폴더의 파일을 보여주고
// - /api/kma/* 요청을 기상청 단기예보 API(공공데이터포털)로 전달하면서 인증키를 붙인다.
//   (브라우저에서 직접 호출하면 CORS로 막히고, 인증키도 노출되기 때문)
//
// 실행:  node server.mjs   →   http://localhost:5173
// 인증키: 같은 폴더의 .env 파일에  KMA_SERVICE_KEY=발급받은키  (Decoding 키 권장, Encoding 키도 가능)
// Node 18 이상 필요 (내장 fetch 사용). 외부 패키지 없음.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

// .env 읽기 (이미 설정된 환경변수가 우선)
try {
  const text = await readFile(path.join(ROOT, '.env'), 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
} catch { /* .env 없음 */ }

const KEY = process.env.KMA_SERVICE_KEY?.trim();
const PORT = Number(process.env.PORT || 5173);
const UPSTREAM = process.env.KMA_UPSTREAM || 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0';
const OPERATIONS = new Set(['getVilageFcst', 'getUltraSrtNcst']); // 단기예보, 초단기실황
const MIME = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };

const sendJson = (res, status, obj) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(obj));
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // ---- 기상청 API 프록시 ----
  if (url.pathname.startsWith('/api/kma/')) {
    const op = url.pathname.slice('/api/kma/'.length);
    if (!OPERATIONS.has(op)) return sendJson(res, 404, { error: `지원하지 않는 API: ${op}` });
    if (!KEY) return sendJson(res, 500, { error: '인증키가 설정되지 않았어요. 폴더의 .env 파일에 KMA_SERVICE_KEY=인증키 를 넣고 서버를 다시 실행하세요.' });
    url.searchParams.delete('serviceKey');
    const key = KEY.includes('%') ? KEY : encodeURIComponent(KEY); // Encoding 키는 그대로, Decoding 키는 인코딩
    const target = `${UPSTREAM}/${op}?serviceKey=${key}&${url.searchParams}`;
    try {
      const r = await fetch(target, { signal: AbortSignal.timeout(15000) });
      const body = await r.text();
      res.writeHead(r.status, { 'content-type': r.headers.get('content-type') || 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(body);
    } catch (e) {
      return sendJson(res, 502, { error: `기상청 서버에 연결할 수 없어요. (${e.name === 'TimeoutError' ? '시간 초과' : e.message})` });
    }
  }

  // ---- 정적 파일 ----
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/trip-weather.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT + path.sep) || path.basename(file).startsWith('.')) return sendJson(res, 403, { error: 'forbidden' });
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: 'not found' });
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`WeatherGo → http://localhost:${PORT}`);
  console.log(KEY ? '인증키: 설정됨' : '인증키: 없음 (.env에 KMA_SERVICE_KEY를 넣어주세요)');
});
