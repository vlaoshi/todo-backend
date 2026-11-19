// 할 일 라우터: 생성(POST) / 목록·단건 조회(GET) / 수정(PATCH) / 삭제(DELETE)
// index.js에서 /api/todos 경로에 연결돼요.
import { Router } from 'express';
import mongoose from 'mongoose';
import Todo from '../models/Todo.js';
import requireAuth from '../middleware/auth.js';

const router = Router();

// 클라이언트가 수정할 수 있는 필드 (user, createdAt 같은 필드는 바꿀 수 없어요)
const EDITABLE_FIELDS = ['text', 'done', 'date', 'dueDate', 'carryCount', 'bonusXp'];

const isValidId = (id) => mongoose.isValidObjectId(id);

// 로그인한 사용자만 쓸 수 있어요. (Firebase 토큰 검사 후 req.userId 설정)
router.use(requireAuth);

// :id 경로의 할 일을 찾아 req.todo에 담아요. (본인 할 일만 찾아져요)
router.param('id', async (req, res, next, id) => {
  const todo = isValidId(id) ? await Todo.findOne({ _id: id, user: req.userId }) : null;
  if (!todo) {
    return res.status(404).json({ message: '할 일을 찾을 수 없어요' });
  }
  req.todo = todo;
  next();
});

// 할 일 목록 조회 (최신순)
// GET /api/todos            → 전체
// GET /api/todos?date=2026-11-16 → 그 날짜의 할 일만
router.get('/', async (req, res) => {
  const filter = { user: req.userId };
  if (req.query.date) filter.date = String(req.query.date);

  const todos = await Todo.find(filter).sort({ createdAt: -1 });
  res.json(todos);
});

// 할 일 하나 조회
router.get('/:id', (req, res) => {
  res.json(req.todo);
});

// 할 일 생성
// 필수: text, date  /  선택: dueDate
router.post('/', async (req, res) => {
  const { text, date, dueDate } = req.body ?? {};

  const todo = await Todo.create({
    user: req.userId,
    text,
    date,
    originDate: date, // 처음 계획한 날 = 처음 하는 날
    dueDate: dueDate || null,
  });

  res.status(201).json(todo);
});

// 내 할 일 전체 삭제 (앱의 "초기화" 버튼)
router.delete('/', async (req, res) => {
  await Todo.deleteMany({ user: req.userId });
  res.status(204).end();
});

// 할 일 수정 (보낸 필드만 바뀌어요)
router.patch('/:id', async (req, res) => {
  const { todo } = req;
  const body = req.body ?? {};

  for (const field of EDITABLE_FIELDS) {
    if (field in body) todo[field] = body[field];
  }

  // 완료 상태가 바뀌면 완료 시각도 함께 맞춰요.
  if (todo.isModified('done')) {
    todo.completedAt = todo.done ? new Date() : null;
  }

  // findOneAndUpdate 대신 save()를 써야 마감일 순서 검사(pre validate)까지 실행돼요.
  await todo.save();
  res.json(todo);
});

// 할 일 삭제
router.delete('/:id', async (req, res) => {
  await req.todo.deleteOne();
  res.status(204).end();
});

export default router;
