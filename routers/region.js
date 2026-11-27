// 지역 이름 API: 좌표 → 행정구역 (카카오 로컬 API, 키는 서버 환경 변수 KAKAO_REST_KEY에만 있어요)
// GET /api/region?lat=37.57&lon=126.98 → { province, city, town }
// - 로그인한 사용자만 쓸 수 있어요. (아무나 외부 요청을 대신 쓰지 못하게)
// - 좌표는 소수점 둘째 자리(약 1km)로 줄이고, 같은 좌표는 하루 동안 저장해서 다시 묻지 않아요.
// - 좌표는 로그에 남기지 않아요.
import { Router } from 'express';
import requireAuth from '../middleware/auth.js';

const router = Router();
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE = 5000; // 저장할 위치 수의 상한 (메모리를 넘게 쓰지 않게)
const cache = new Map(); // "lon,lat" → { at, value }

router.use(requireAuth);

router.get('/', async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return res.status(400).json({ message: '위치 값이 올바르지 않아요' });
  }

  const key = process.env.KAKAO_REST_KEY;
  if (!key) return res.status(503).json({ message: '지역 서비스가 아직 설정되지 않았어요' });

  const x = lon.toFixed(2);
  const y = lat.toFixed(2);
  const cacheKey = `${x},${y}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < DAY_MS) return res.json(hit.value);

  let json;
  try {
    const response = await fetch(
      `https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${x}&y=${y}`,
      { headers: { Authorization: `KakaoAK ${key}` } }
    );
    if (!response.ok) throw new Error(`카카오 응답 ${response.status}`);
    json = await response.json();
  } catch (err) {
    // 좌표는 빼고 오류 종류만 남겨요
    console.error('지역 이름 찾기 실패:', err.message);
    return res.status(502).json({ message: '지역 이름을 가져오지 못했어요' });
  }

  // 법정동(B) 기준으로 골라요. 없으면 첫 번째 결과를 써요.
  const doc = (json.documents ?? []).find((d) => d.region_type === 'B') ?? json.documents?.[0];
  if (!doc) return res.status(404).json({ message: '행정구역을 찾지 못했어요' });

  const value = {
    province: doc.region_1depth_name || '',
    city: doc.region_2depth_name || '',
    town: doc.region_3depth_name || '',
  };
  if (cache.size >= MAX_CACHE) cache.clear(); // 꽉 차면 비우고 다시 쌓아요 (간단하고 충분해요)
  cache.set(cacheKey, { at: Date.now(), value });
  res.json(value);
});

export default router;
