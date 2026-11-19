// 애플리케이션 진입점
// 배포: 클라우드타입 (GitHub main 브랜치와 연동, 환경 변수는 클라우드타입 서비스 설정에서 관리)
// 코드를 main에 push하면 클라우드타입이 자동으로 다시 배포해요.
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import todosRouter from './routers/todos.js';
import profileRouter from './routers/profile.js';
import { initFirebase } from './lib/firebase.js';

// .env 읽기: `node index.js`, `npm run dev` 어느 쪽으로 실행해도 적용돼요.
// 터미널 위치와 상관없이 이 파일 옆의 .env를 읽어요. (파일이 없으면 건너뛰어요)
// 이미 설정된 환경 변수는 덮어쓰지 않아요.
try {
  process.loadEnvFile(new URL('.env', import.meta.url));
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}

// 환경 변수가 없으면 기본값 사용
// (5000번은 macOS AirPlay 수신기가 점유하고 있어 5050번 사용)
const PORT = process.env.PORT || 5050;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/todo';

// 요청을 허용할 프론트엔드 주소 (쉼표로 여러 개)
// 기본값: VS Code Live Server(5500 포트)와 Firebase Hosting 주소
const CORS_ORIGINS = (
  process.env.CORS_ORIGINS ||
  'http://localhost:5500,http://127.0.0.1:5500,https://hw-todo-7efc9.web.app,https://hw-todo-7efc9.firebaseapp.com'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Firebase Admin SDK 준비 (키 파일이 없거나 잘못되면 이유를 알려 주고 종료해요)
try {
  initFirebase();
} catch (err) {
  console.error('Firebase 설정 오류:', err.message);
  process.exit(1);
}

const app = express();

// CORS: 반드시 라우터와 인증보다 먼저 둬요.
// 브라우저의 OPTIONS 사전 요청(preflight)에는 토큰이 없어서,
// 인증보다 뒤에 있으면 401로 막혀 버려요. cors가 여기서 바로 204로 응답해요.
app.use(
  cors({
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600, // 사전 요청 결과를 브라우저가 10분 동안 기억해요.
  })
);

// JSON 요청 본문 파싱 (할 일·프로필 요청은 작아서 10kb로 제한해요)
app.use(express.json({ limit: '10kb' }));

// 서버 상태 확인용 라우트: 몽고디비(Atlas) 연결 상태를 실제로 확인해서 알려줘요
// (readyState 1 = 연결됨)
app.get('/', (req, res) => {
  if (mongoose.connection.readyState === 1) {
    return res.json({ message: '새로운 클라우드 데이터베이스 연결 성공' });
  }
  res.status(503).json({ message: '데이터베이스에 연결되어 있지 않아요' });
});

// 서버 상태 확인용 (로그인 없이 접근 가능)
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// 할 일 API (로그인 필요)
app.use('/api/todos', todosRouter);

// 다마고치 프로필 API (로그인 필요)
app.use('/api/profile', profileRouter);

// 에러 처리: 검증 실패는 400, 그 밖의 오류는 500
// (Express 5는 async 라우터에서 난 에러도 자동으로 여기로 넘겨줘요)
app.use((err, req, res, next) => {
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ message: messages.join(', ') });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: '요청 본문이 올바른 JSON이 아니에요' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: '요청 본문이 너무 커요' });
  }
  console.error(err);
  res.status(500).json({ message: '서버 오류가 발생했어요' });
});

// 몽고디비 연결 후 서버 실행
try {
  await mongoose.connect(MONGODB_URI);
  console.log('연결 성공');

  app.listen(PORT, () => {
    console.log(`서버 실행 중: http://localhost:${PORT}`);
  });
} catch (err) {
  console.error('몽고디비 연결 실패:', err.message);
  process.exit(1);
}
