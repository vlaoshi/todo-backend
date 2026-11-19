// Firebase Admin SDK 초기화
// 서비스 계정 키(JSON) 파일 경로는 .env의 FIREBASE_SERVICE_ACCOUNT_PATH로 받아요.
// ⚠️ 키 내용과 경로는 비밀 정보라 로그에 절대 출력하지 않아요.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export const FIREBASE_PROJECT_ID = 'hw-todo-7efc9';

// 프로젝트 폴더 (상대 경로는 터미널 위치가 아니라 이 폴더를 기준으로 찾아요)
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let auth = null;
let db = null;

// 키 파일을 읽어 SDK를 초기화해요. 문제가 있으면 이유를 담은 Error를 던져요.
// (오류 메시지에는 경로나 키 내용을 넣지 않아요)
export function initFirebase() {
  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!keyPath) {
    throw new Error('.env에 FIREBASE_SERVICE_ACCOUNT_PATH가 없어요. (.env.example 참고)');
  }

  let raw;
  try {
    raw = readFileSync(path.resolve(PROJECT_ROOT, keyPath), 'utf8');
  } catch {
    throw new Error('서비스 계정 키 파일을 읽을 수 없어요. FIREBASE_SERVICE_ACCOUNT_PATH를 확인해 주세요.');
  }

  let key;
  try {
    key = JSON.parse(raw);
  } catch {
    throw new Error('서비스 계정 키 파일이 올바른 JSON이 아니에요.');
  }

  if (key.type !== 'service_account' || !key.private_key || !key.client_email) {
    throw new Error('서비스 계정 키 파일이 아니에요. Firebase 콘솔에서 "새 비공개 키 생성"으로 받은 파일을 넣어 주세요.');
  }
  if (key.project_id !== FIREBASE_PROJECT_ID) {
    throw new Error(`다른 Firebase 프로젝트의 키예요. ${FIREBASE_PROJECT_ID} 프로젝트의 키를 넣어 주세요.`);
  }

  let app;
  try {
    app = initializeApp({ credential: cert(key), projectId: FIREBASE_PROJECT_ID });
  } catch {
    throw new Error('서비스 계정 키 형식이 잘못됐어요. 키 파일을 새로 받아 주세요.');
  }

  auth = getAuth(app);
  db = getFirestore(app);
}

export const firebaseAuth = () => auth;
export const firestore = () => db;
