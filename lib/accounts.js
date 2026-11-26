// 가입 명단과 가입 정원(20개) 관리
// ---------------------------------------------------------
// 예전에는 프론트엔드가 Firestore에 직접 기록했어요. 이제는 이 서버가 MongoDB에 기록해요.
//
// ▶ 정원 카운터: counters 컬렉션의 { _id: 'signup', count }
//   - 자리 잡기는 "count가 20보다 작을 때만 +1"을 한 번에(원자적으로) 해서,
//     여러 사람이 동시에 가입해도 20개를 넘지 않아요.
//
// ▶ Firestore에서 옮겨 오기 (이전 기간 동안만 필요해요)
//   - 카운터가 아직 없으면 Firestore의 meta/signup 숫자로 시작해요.
//   - MongoDB 명단에 없는 사용자는 Firestore의 accounts/{uid}를 한 번 확인해서, 있으면 복사해요.
//     (이미 카운터에 들어 있는 사람이라 카운터는 올리지 않아요)
//   - 모든 기존 사용자가 한 번씩 접속해서 옮겨지면 이 부분(fromFirestore)은 지워도 돼요.
import mongoose from 'mongoose';
import Account from '../models/Account.js';
import { firestore } from './firebase.js';

export const MAX_ACCOUNTS = 20; // 프론트엔드 MAX_ACCOUNTS와 같게

const counters = () => mongoose.connection.collection('counters');

// Firestore 읽기는 실패해도 서비스가 멈추지 않게, 실패하면 '없음'으로 봐요.
async function readFirestore(path) {
  try {
    const snap = await firestore().doc(path).get();
    return snap.exists ? snap.data() : null;
  } catch (err) {
    console.error('Firestore 읽기 실패:', err?.code ?? '알 수 없는 오류');
    return null;
  }
}

// 카운터가 없으면 만들어요. (처음 한 번: Firestore 숫자와 지금 명단 수 중 큰 값으로 시작)
async function ensureCounter() {
  if (await counters().findOne({ _id: 'signup' })) return;
  const old = await readFirestore('meta/signup');
  const start = Math.max(old?.count || 0, await Account.countDocuments());
  // 동시에 두 번 만들려고 해도 하나만 생겨요. ($setOnInsert)
  await counters().updateOne({ _id: 'signup' }, { $setOnInsert: { count: start } }, { upsert: true });
}

// 지금까지 가입한 계정 수
export async function getSignupCount() {
  await ensureCounter();
  const doc = await counters().findOne({ _id: 'signup' });
  return doc?.count ?? 0;
}

// 명단에 있으면 true. MongoDB에 없으면 Firestore에서 옮겨 와요.
export async function isMember(uid) {
  if (await Account.exists({ _id: uid })) return true;
  const old = await readFirestore(`accounts/${uid}`);
  if (!old?.username) return false;
  await ensureCounter(); // 카운터를 Firestore 숫자로 먼저 맞춰 둬요 (옮겨 온 사람은 이미 세어져 있어요)
  await Account.updateOne(
    { _id: uid },
    { $setOnInsert: { username: old.username, createdAt: old.createdAt ? new Date(old.createdAt) : new Date() } },
    { upsert: true }
  );
  return true;
}

// 명단에 자리 잡기. 이미 있으면 그대로 true, 정원이 다 찼으면 false.
export async function claimSlot(uid, username) {
  if (await isMember(uid)) return true;
  await ensureCounter();
  // count가 정원보다 작을 때만 +1 (한 번에 처리해서 동시에 가입해도 넘치지 않아요)
  const res = await counters().updateOne({ _id: 'signup', count: { $lt: MAX_ACCOUNTS } }, { $inc: { count: 1 } });
  if (res.modifiedCount === 0) return false;
  try {
    await Account.create({ _id: uid, username });
  } catch (err) {
    // 같은 사람이 동시에 두 번 요청한 경우: 이미 들어갔으니 올린 숫자만 되돌려요.
    await counters().updateOne({ _id: 'signup' }, { $inc: { count: -1 } });
    if (err.code === 11000 && (await Account.exists({ _id: uid }))) return true;
    throw err;
  }
  return true;
}
