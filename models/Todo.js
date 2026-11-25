// 할 일 모델
// Firebase의 users/{uid}/todos/{todoId} 하위 컬렉션을 별도 컬렉션으로 옮기고,
// user 필드로 주인을 구분해요.
import mongoose from 'mongoose';

// 날짜 문자열 "YYYY-MM-DD" 규칙 (프론트엔드가 날짜를 이 형식으로 다뤄요)
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MESSAGE = '날짜는 YYYY-MM-DD 형식이어야 해요';

const todoSchema = new mongoose.Schema(
  {
    // 할 일 주인 (Firebase 사용자 uid, 만든 뒤에는 바꿀 수 없어요)
    user: {
      type: String,
      required: true,
      immutable: true,
      index: true,
    },

    // 할 일 내용 (최대 60자, 프론트엔드 MAX_TEXT_LENGTH와 같게)
    text: {
      type: String,
      required: [true, '할 일을 입력해 주세요'],
      trim: true,
      minlength: [1, '할 일을 입력해 주세요'],
      maxlength: [60, '할 일은 60자까지 쓸 수 있어요'],
    },

    // 완료 여부와 완료 시각
    done: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },

    // 하는 날 (내일로/오늘로 넘기면 바뀌어요)
    date: {
      type: String,
      required: true,
      match: [DATE_PATTERN, DATE_MESSAGE],
    },

    // 처음 계획한 날 (생성할 때 date와 같게 저장하고, 이후에는 바뀌지 않아요)
    originDate: {
      type: String,
      required: true,
      immutable: true,
      match: [DATE_PATTERN, DATE_MESSAGE],
    },

    // 마감일 (선택). 빈 문자열("")이 오면 null로 저장해요.
    dueDate: {
      type: String,
      default: null,
      set: (v) => (v === '' ? null : v),
      match: [DATE_PATTERN, DATE_MESSAGE],
    },

    // 다른 날로 넘긴 횟수 (넘길 때마다 XP -5)
    carryCount: {
      type: Number,
      default: 0,
      min: [0, '넘긴 횟수는 0 이상이어야 해요'],
      validate: { validator: Number.isInteger, message: '넘긴 횟수는 정수여야 해요' },
    },

    // 반복 할 일에서 만들어졌다면 그 반복(Routine)의 id, 보통 할 일은 null
    routineId: {
      type: String,
      default: null,
      immutable: true,
    },

    // 마감일 안에 완료해서 받은 보너스 XP (완료 해제 시 회수하려고 기억해 둬요)
    bonusXp: {
      type: Number,
      default: 0,
      min: [0, '보너스 XP는 0 이상이어야 해요'],
      validate: { validator: Number.isInteger, message: '보너스 XP는 정수여야 해요' },
    },
  },
  {
    timestamps: true,
    // 응답 형식: _id → id(문자열), __v와 user는 빼요.
    toJSON: {
      versionKey: false,
      transform(doc, ret) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.user;
        return ret;
      },
    },
  }
);

// 마감일은 하는 날과 같거나 그 뒤여야 해요. (문자열 비교로 날짜 순서 비교 가능)
todoSchema.pre('validate', function () {
  if (this.dueDate && this.dueDate < this.date) {
    this.invalidate('dueDate', '마감일은 하는 날과 같거나 그 뒤로 정해 주세요');
  }
});

// 자주 쓰는 조회: "이 사용자의 특정 날짜 할 일" / "이 사용자의 할 일 최신순"
todoSchema.index({ user: 1, date: 1 });
todoSchema.index({ user: 1, createdAt: -1 });

// 같은 날 같은 반복 할 일이 두 번 생기지 않게 막아요. (반복에서 온 할 일에만 적용)
todoSchema.index(
  { user: 1, routineId: 1, date: 1 },
  { unique: true, partialFilterExpression: { routineId: { $type: 'string' } } }
);

export default mongoose.model('Todo', todoSchema);
