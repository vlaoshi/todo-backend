// 반복 할 일 라우터: 목록(GET) / 만들기(POST) / 그만하기(DELETE) / 그날 할 일 만들기(POST materialize)
// index.js에서 /api/routines 경로에 연결돼요.
import { Router } from 'express';
import mongoose from 'mongoose';
import Routine from '../models/Routine.js';
import Todo from '../models/Todo.js';
import requireAuth from '../middleware/auth.js';

const router = Router();

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// "YYYY-MM-DD" → 요일 번호(0 일 ~ 6 토)
// UTC로 계산해서 서버가 어느 시간대에 있든 같은 요일이 나와요.
function weekdayOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// 로그인한 사용자만 쓸 수 있어요. (Firebase 토큰 검사 후 req.userId 설정)
router.use(requireAuth);

// 반복 중인 틀 목록 (오래된 순)
router.get('/', async (req, res) => {
  const routines = await Routine.find({ user: req.userId, active: true }).sort({ createdAt: 1 });
  res.json(routines);
});

// 반복 만들기
// 필수: text, days(요일 번호 배열), startDate
router.post('/', async (req, res) => {
  const { text, days, startDate } = req.body ?? {};
  const routine = await Routine.create({ user: req.userId, text, days, startDate });
  res.status(201).json(routine);
});

// 그 날짜에 해당하는 반복 할 일을 만들어요. (이미 있으면 그대로 두고, 없을 때만 만들어요)
// 본문: { date: "YYYY-MM-DD" }  →  응답: 그날의 반복 할 일 목록
// ※ '/:id'보다 먼저 둬야 'materialize'가 id로 잘못 읽히지 않아요.
router.post('/materialize', async (req, res) => {
  const date = String(req.body?.date ?? '');
  if (!DATE_PATTERN.test(date)) {
    return res.status(400).json({ message: '날짜는 YYYY-MM-DD 형식이어야 해요' });
  }

  // 반복 중이고, 그 요일이 들어 있고, 시작일이 지난 틀만 골라요.
  const routines = await Routine.find({
    user: req.userId,
    active: true,
    days: weekdayOf(date),
    startDate: { $lte: date },
  });

  const now = new Date();
  for (const routine of routines) {
    try {
      // upsert + $setOnInsert: 없을 때만 새로 만들고, 이미 있으면 아무것도 바꾸지 않아요.
      // timestamps: false → 이미 있는 할 일의 updatedAt이 매번 바뀌지 않게 직접 넣어요.
      await Todo.updateOne(
        { user: req.userId, routineId: String(routine._id), date },
        {
          $setOnInsert: {
            text: routine.text,
            originDate: date,
            done: false,
            completedAt: null,
            dueDate: null,
            carryCount: 0,
            bonusXp: 0,
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true, timestamps: false }
      );
    } catch (err) {
      // 같은 순간에 두 번 요청하면 유니크 인덱스가 하나를 막아요. 이미 만들어진 거라 괜찮아요.
      if (err.code !== 11000) throw err;
    }
  }

  const todos = await Todo.find({ user: req.userId, date, routineId: { $ne: null } }).sort({
    createdAt: -1,
  });
  res.json(todos);
});

// 반복 그만하기 (이미 만들어진 할 일은 남겨 둬요)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const routine = mongoose.isValidObjectId(id)
    ? await Routine.findOneAndUpdate(
        { _id: id, user: req.userId },
        { active: false },
        { returnDocument: 'after' }
      )
    : null;
  if (!routine) {
    return res.status(404).json({ message: '반복 할 일을 찾을 수 없어요' });
  }
  res.status(204).end();
});

export default router;
