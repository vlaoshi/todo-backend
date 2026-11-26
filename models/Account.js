// 가입 명단 모델 (예전 Firestore의 accounts/{uid}를 옮겼어요)
// - _id: Firebase 사용자 uid
// - username: 아이디 (가짜 이메일의 @ 앞부분)
// 이 명단에 있는 계정만 할 일·프로필 API를 쓸 수 있어요. (계정 20개 제한)
import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    username: { type: String, required: true, unique: true },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model('Account', accountSchema);
