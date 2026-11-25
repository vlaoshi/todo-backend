// 반복 할 일 모델 ('틀')
// - 매일 또는 정해진 요일마다 할 일을 자동으로 만들어 주는 설정이에요.
// - 실제로 체크하는 할 일(Todo)은 접속한 날짜에 이 틀을 보고 하나씩 만들어져요.
//   (Todo.routineId로 어느 틀에서 왔는지 연결돼요)
import mongoose from 'mongoose';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const routineSchema = new mongoose.Schema(
  {
    // 반복 주인 (Firebase 사용자 uid, 만든 뒤에는 바꿀 수 없어요)
    user: {
      type: String,
      required: true,
      immutable: true,
      index: true,
    },

    // 할 일 내용 (Todo와 같은 규칙: 최대 60자)
    text: {
      type: String,
      required: [true, '할 일을 입력해 주세요'],
      trim: true,
      minlength: [1, '할 일을 입력해 주세요'],
      maxlength: [60, '할 일은 60자까지 쓸 수 있어요'],
    },

    // 반복할 요일 번호: 0 일, 1 월, 2 화, 3 수, 4 목, 5 금, 6 토
    // 중복은 없애고 작은 순서로 정리해서 저장해요. 예: [5, 1, 1] → [1, 5]
    days: {
      type: [Number],
      // 배열이 아닌 값이 오면 그대로 두고, 아래 validate가 오류로 알려 줘요.
      set: (list) => (Array.isArray(list) ? [...new Set(list)].sort((a, b) => a - b) : list),
      validate: {
        validator: (list) =>
          Array.isArray(list) &&
          list.length > 0 &&
          list.every((d) => Number.isInteger(d) && d >= 0 && d <= 6),
        message: '반복할 요일을 하나 이상 골라 주세요',
      },
    },

    // 반복을 시작하는 날 "YYYY-MM-DD" (이 날짜 전에는 만들지 않아요)
    startDate: {
      type: String,
      required: true,
      match: [DATE_PATTERN, '날짜는 YYYY-MM-DD 형식이어야 해요'],
    },

    // 반복 중인지 (반복 그만하기를 누르면 false, 이미 만든 할 일은 그대로 남아요)
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    // 응답 형식: _id → id(문자열), __v와 user는 빼요. (Todo와 같게)
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

// 자주 쓰는 조회: "이 사용자의 반복 중인 틀"
routineSchema.index({ user: 1, active: 1 });

export default mongoose.model('Routine', routineSchema);
