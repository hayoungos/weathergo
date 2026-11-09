// Vercel Serverless Function — /api/kma/:op
// 브라우저 대신 기상청 단기예보 API(공공데이터포털)를 호출하고 인증키를 붙인다.
// 인증키는 Vercel 프로젝트 환경변수 KMA_SERVICE_KEY 에서만 읽는다. (코드·저장소에 없음)

const UPSTREAM = process.env.KMA_UPSTREAM || 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0';
const OPERATIONS = new Set(['getVilageFcst', 'getUltraSrtNcst']); // 단기예보, 초단기실황
const PARAMS = new Set(['base_date', 'base_time', 'nx', 'ny', 'pageNo', 'numOfRows', 'dataType']);

const sendJson = (res, status, obj) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(obj));
};

module.exports = async (req, res) => {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'GET만 지원해요.' });
  const op = String(req.query.op || '');
  if (!OPERATIONS.has(op)) return sendJson(res, 404, { error: `지원하지 않는 API: ${op}` });

  const KEY = (process.env.KMA_SERVICE_KEY || '').trim();
  if (!KEY) return sendJson(res, 500, { error: '서버에 인증키가 설정되지 않았어요. (Vercel 환경변수 KMA_SERVICE_KEY)' });

  // 허용한 파라미터만 전달 (serviceKey 등 외부 입력 차단)
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) if (PARAMS.has(k)) qs.set(k, String(Array.isArray(v) ? v[0] : v));
  const key = KEY.includes('%') ? KEY : encodeURIComponent(KEY); // Encoding 키는 그대로, Decoding 키는 인코딩

  try {
    const r = await fetch(`${UPSTREAM}/${op}?serviceKey=${key}&${qs}`, { signal: AbortSignal.timeout(10000) });
    const body = await r.text();
    res.statusCode = r.status;
    res.setHeader('content-type', r.headers.get('content-type') || 'text/plain; charset=utf-8');
    // 같은 발표분은 내용이 같으므로 CDN에서 5분 재사용 (API 호출량 절약)
    res.setHeader('cache-control', r.ok && /"resultCode"\s*:\s*"00"/.test(body) ? 'public, s-maxage=300' : 'no-store');
    res.end(body);
  } catch (e) {
    sendJson(res, 502, { error: `기상청 서버에 연결할 수 없어요. (${e.name === 'TimeoutError' ? '시간 초과' : e.message})` });
  }
};
