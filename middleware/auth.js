// 로그인 인증 미들웨어 (requireAuth)
// Authorization: Bearer <Firebase ID Token> 헤더를 검사해서 req.userId(Firebase uid)를 채워요.
// 할 일·프로필 라우터가 함께 써요.
//
// 검사 순서
// 1) 토큰이 있는지                → 없으면 401
// 2) 토큰이 진짜이고 유효한지      → 만료·위조면 401
// 3) 아이디·비밀번호 계정인지      → 아니면 403
// 4) 가입 명단(accounts/{uid})에 있는지 → 없으면 403 (계정 20개 제한 유지)
//
// ⚠️ 실패 이유의 자세한 내용(토큰 값, 내부 오류)은 응답이나 로그에 남기지 않아요.
import { firebaseAuth, firestore } from '../lib/firebase.js';

const UNAUTHORIZED = { message: '로그인이 필요해요.' };
const FORBIDDEN = { message: '사용할 수 없는 계정이에요.' };

// 가입 명단에서 확인된 uid (매 요청마다 Firestore를 읽지 않으려고 메모리에 기억해요)
// 확인된 경우만 저장해요. 없던 계정이 나중에 가입할 수도 있으니까요.
const memberCache = new Map();

async function isMember(uid) {
  if (memberCache.has(uid)) return true;
  const snap = await firestore().collection('accounts').doc(uid).get();
  if (snap.exists) memberCache.set(uid, true);
  return snap.exists;
}

export default async function requireAuth(req, res, next) {
  // 1) "Bearer <토큰>"에서 토큰만 꺼내요.
  const match = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') ?? '');
  if (!match) return res.status(401).json(UNAUTHORIZED);

  // 2) 토큰 검사 (서명, 만료, 발급 프로젝트까지 확인해요)
  let decoded;
  try {
    decoded = await firebaseAuth().verifyIdToken(match[1]);
  } catch {
    return res.status(401).json(UNAUTHORIZED);
  }

  // 3) 아이디·비밀번호로 로그인한 계정만 허용해요.
  if (decoded.firebase?.sign_in_provider !== 'password') {
    return res.status(403).json(FORBIDDEN);
  }

  // 4) 가입 명단 확인
  let member;
  try {
    member = await isMember(decoded.uid);
  } catch (err) {
    // Firestore에 연결할 수 없는 경우 등: 사용자 잘못이 아니라 서버 문제예요.
    // 내부 오류 내용은 남기지 않고 오류 코드만 기록해요.
    console.error('가입 명단 확인 실패:', err?.code ?? '알 수 없는 오류');
    return res.status(500).json({ message: '서버 오류가 발생했어요' });
  }
  if (!member) return res.status(403).json(FORBIDDEN);

  req.userId = decoded.uid;
  next();
}
