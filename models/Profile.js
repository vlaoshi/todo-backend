// 다마고치 프로필 모델 (사용자마다 하나)
// XP와 진화 단계, "지난 일 가져오기"를 물어본 날짜를 저장해요.
import mongoose from 'mongoose';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// 진화 단계 기준: xp가 minXp 이상이면 그 단계예요. (minXp 오름차순)
export const STAGES = [
  { stage: 1, name: '알', minXp: 0 },
  { stage: 2, name: '아기', minXp: 40 },
  { stage: 3, name: '청소년', minXp: 100 },
  { stage: 4, name: '어른', minXp: 180 },
  { stage: 5, name: '전설의 갓생 다마고치', minXp: 280 },
];

// xp로 단계 계산 (자바스크립트용)
export function stageForXp(xp) {
  let result = 1;
  for (const { stage, minXp } of STAGES) {
    if (xp >= minXp) result = stage;
  }
  return result;
}

// xp로 단계 계산 (MongoDB 업데이트 파이프라인용 식)
// 높은 단계부터 검사해서 처음 맞는 단계를 골라요.
export function stageExpr(xpExpr) {
  return {
    $switch: {
      branches: [...STAGES].reverse().map(({ stage, minXp }) => ({
        case: { $gte: [xpExpr, minXp] },
        then: stage,
      })),
      default: 1,
    },
  };
}

const profileSchema = new mongoose.Schema(
  {
    // 프로필 주인 (Firebase 사용자 uid)
    user: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
    },

    // 다마고치 경험치
    xp: {
      type: Number,
      default: 0,
      min: [0, 'XP는 0 이상이어야 해요'],
      validate: { validator: Number.isInteger, message: 'XP는 정수여야 해요' },
    },

    // 진화 단계 1~5 (서버가 xp로 계산해요)
    stage: {
      type: Number,
      default: 1,
      min: 1,
      max: 5,
    },

    // 마지막으로 "지난 일 가져오기"를 물어본 날 "YYYY-MM-DD"
    lastCheckInDate: {
      type: String,
      default: null,
      match: [DATE_PATTERN, '날짜는 YYYY-MM-DD 형식이어야 해요'],
    },

    // 게임기에 새긴 문구 (예: "작심 30년!", "민지의 투두")
    // null: 아직 안 물어봄 → 앱이 처음 열릴 때 각인 안내를 보여 줘요 / "": 안 새기기로 함(기본 로고)
    engraving: {
      type: String,
      default: null,
      trim: true,
      maxlength: [20, '게임기 각인은 20자까지 쓸 수 있어요'],
    },
  },
  {
    timestamps: true,
    // 응답 형식: _id, __v, user는 빼요.
    toJSON: {
      versionKey: false,
      transform(doc, ret) {
        delete ret._id;
        delete ret.user;
        return ret;
      },
    },
  }
);

// save()로 저장할 때도 단계가 xp와 어긋나지 않게 맞춰요.
profileSchema.pre('validate', function () {
  this.stage = stageForXp(this.xp);
});

export default mongoose.model('Profile', profileSchema);
