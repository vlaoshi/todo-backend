// 사용자 모델
// Firebase의 accounts/{uid}(가입 명단)와 users/{uid}(다마고치 프로필)를 하나로 합쳤어요.
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    // 로그인 아이디: 영문 소문자, 숫자, _ 로 4~12자 (프론트엔드 ID_PATTERN과 같은 규칙)
    username: {
      type: String,
      required: [true, '아이디를 입력해 주세요'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9_]{4,12}$/, '아이디는 영문 소문자, 숫자, _ 로 4~12자여야 해요'],
    },

    // 비밀번호 해시값 (원문 비밀번호는 절대 저장하지 않아요)
    // select: false → 조회할 때 기본으로 빠지고, 로그인 확인할 때만 .select('+passwordHash')로 가져와요.
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    // 다마고치 경험치 (할 일 완료 +20, 포기 -10 등으로 바뀌어요)
    xp: {
      type: Number,
      default: 0,
      min: 0,
    },

    // 다마고치 단계: 1 알 → 2 아기 → 3 청소년 → 4 어른 → 5 전설의 갓생 다마고치
    stage: {
      type: Number,
      default: 1,
      min: 1,
      max: 5,
    },

    // 마지막으로 '지난 일 가져오기'를 확인한 날 "YYYY-MM-DD"
    lastCheckInDate: {
      type: String,
      default: null,
      match: [/^\d{4}-\d{2}-\d{2}$/, '날짜는 YYYY-MM-DD 형식이어야 해요'],
    },
  },
  {
    // createdAt, updatedAt 자동 관리
    timestamps: true,
    toJSON: {
      virtuals: true, // _id 대신 id로 내보내기
      versionKey: false,
      transform(doc, ret) {
        delete ret._id;
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

export default mongoose.model('User', userSchema);
