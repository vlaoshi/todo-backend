// 여러 모델과 라우터가 함께 쓰는 입력 형식 검사
// (예전에는 같은 날짜 규칙이 다섯 파일에 따로 있었어요. 한 곳에서만 바꾸면 되게 모았어요)

// 날짜 문자열 "YYYY-MM-DD" 규칙 (프론트엔드가 날짜를 이 형식으로 다뤄요)
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const DATE_MESSAGE = '날짜는 YYYY-MM-DD 형식이어야 해요';
