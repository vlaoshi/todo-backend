// 다마고치 프로필 라우터: 조회(GET) / 변경(PATCH) / 초기화(DELETE)
// index.js에서 /api/profile 경로에 연결돼요.
import { Router } from 'express';
import requireAuth from '../middleware/auth.js';
import Profile, { stageExpr } from '../models/Profile.js';

const router = Router();

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const XP_DELTA_LIMIT = 100;
const ENGRAVING_MAX = 20; // 게임기 각인 글자 수 한도 (프론트와 같게)

// 로그인한 사용자만 쓸 수 있어요. (Firebase 토큰 검사 후 req.userId 설정)
router.use(requireAuth);

// 업데이트 옵션 공통
// - upsert: 프로필이 없으면 만들어요. (user 필드는 조회 조건에서 채워져요)
// - returnDocument: 'after' → 바뀐 뒤의 문서를 돌려받아요. (Mongoose 9에서 new: true 대신 써요)
// - timestamps: false → createdAt/updatedAt은 아래에서 직접 관리해요.
//   (Mongoose가 자동으로 넣으면 GET만 해도 updatedAt이 바뀌어 버려요)
const UPSERT_OPTIONS = { upsert: true, returnDocument: 'after', timestamps: false };

// 내 프로필 조회 (없으면 기본값으로 만들어요)
// $setOnInsert는 새로 만들 때만 적용돼서, 이미 있으면 아무것도 바뀌지 않아요.
// 동시에 두 번 요청이 와도 user가 unique라 하나만 만들어져요.
router.get('/', async (req, res) => {
  const now = new Date();
  const profile = await Profile.findOneAndUpdate(
    { user: req.userId },
    {
      $setOnInsert: {
        xp: 0,
        stage: 1,
        lastCheckInDate: null,
        createdAt: now,
        updatedAt: now,
      },
    },
    UPSERT_OPTIONS
  );
  res.json(profile);
});

// 내 프로필 변경
// 본문: { xpDelta?: 정수(-100~100), lastCheckInDate?: "YYYY-MM-DD" | null, engraving?: 문자열(20자까지) }
//   engraving: 게임기에 새긴 문구. ""(빈 문자열)은 '안 새기기로 함'(기본 로고), 아직 안 물어봤으면 null
// 그 밖의 필드(xp, stage, user 등)는 무시해요.
router.patch('/', async (req, res) => {
  const body = req.body ?? {};

  // 입력 검사 (파이프라인 업데이트에는 스키마 검증이 적용되지 않아서 여기서 직접 해요)
  const hasDelta = 'xpDelta' in body;
  const hasCheckIn = 'lastCheckInDate' in body;
  const hasEngraving = 'engraving' in body;
  const { xpDelta, lastCheckInDate } = body;
  const engraving = typeof body.engraving === 'string' ? body.engraving.trim() : body.engraving;

  if (
    hasDelta &&
    (!Number.isInteger(xpDelta) || Math.abs(xpDelta) > XP_DELTA_LIMIT)
  ) {
    return res
      .status(400)
      .json({ message: `xpDelta는 -${XP_DELTA_LIMIT}~${XP_DELTA_LIMIT} 사이의 정수여야 해요` });
  }
  if (
    hasCheckIn &&
    lastCheckInDate !== null &&
    !(typeof lastCheckInDate === 'string' && DATE_PATTERN.test(lastCheckInDate))
  ) {
    return res
      .status(400)
      .json({ message: 'lastCheckInDate는 YYYY-MM-DD 형식이거나 null이어야 해요' });
  }
  if (hasEngraving && !(typeof engraving === 'string' && engraving.length <= ENGRAVING_MAX)) {
    return res.status(400).json({ message: `게임기 각인은 ${ENGRAVING_MAX}자까지 쓸 수 있어요` });
  }

  // 원자적 업데이트 파이프라인 (단계는 위에서부터 차례로 적용돼요)
  // 1) xp에 변화량을 더하되 0 밑으로 내려가지 않게 해요. 새 문서면 xp가 없으니 0에서 시작해요.
  // 2) 바뀐 xp로 단계를 다시 계산해요.
  // 3) 체크인 날짜, 게임기 각인, 시각 필드를 맞춰요.
  const pipeline = [
    {
      $set: {
        xp: { $max: [0, { $add: [{ $ifNull: ['$xp', 0] }, hasDelta ? xpDelta : 0] }] },
      },
    },
    {
      $set: {
        stage: stageExpr('$xp'),
        lastCheckInDate: hasCheckIn
          ? { $literal: lastCheckInDate }
          : { $ifNull: ['$lastCheckInDate', null] },
        engraving: hasEngraving ? { $literal: engraving } : { $ifNull: ['$engraving', null] },
        createdAt: { $ifNull: ['$createdAt', '$$NOW'] },
        updatedAt: '$$NOW',
      },
    },
  ];

  const profile = await Profile.findOneAndUpdate({ user: req.userId }, pipeline, {
    ...UPSERT_OPTIONS,
    updatePipeline: true, // Mongoose 9는 배열(파이프라인) 업데이트를 이 옵션이 있어야 허용해요.
  });
  res.json(profile);
});

// 내 프로필 삭제 (앱의 "초기화" 버튼). 다음 GET 때 기본값으로 다시 만들어져요.
router.delete('/', async (req, res) => {
  await Profile.deleteOne({ user: req.userId });
  res.status(204).end();
});

export default router;
