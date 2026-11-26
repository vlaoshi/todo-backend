// 가입 API (예전에는 프론트엔드가 Firestore에 직접 기록했어요)
//   GET  /api/accounts/slots  남은 자리 보기 (로그인 없이) → { count, max, left }
//   POST /api/accounts        가입 명단에 등록 (Firebase 계정을 만든 뒤 바로 불러요)
//                             → 200 { ok: true } / 정원이 다 찼으면 409
import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import { claimSlot, getSignupCount, MAX_ACCOUNTS } from '../lib/accounts.js';

const router = Router();

router.get('/slots', async (req, res) => {
  const count = await getSignupCount();
  res.json({ count, max: MAX_ACCOUNTS, left: Math.max(0, MAX_ACCOUNTS - count) });
});

router.post('/', verifyToken, async (req, res) => {
  // 아이디는 사용자가 보낸 값이 아니라 토큰의 이메일(아이디@...)에서 꺼내요. (남의 아이디로 등록 못 하게)
  const username = req.userEmail.split('@')[0];
  if (!username) return res.status(400).json({ message: '아이디 계정이 아니에요' });
  const ok = await claimSlot(req.userId, username);
  if (!ok) return res.status(409).json({ message: `계정 정원(${MAX_ACCOUNTS}개)이 모두 찼어요` });
  res.json({ ok: true });
});

export default router;
