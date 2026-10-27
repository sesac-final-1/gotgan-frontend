// 알림 시각 표시 — 방금 · N분 전 · N시간 전 · 하루가 지나면 월.일
export const ago = (date, now = new Date()) => {
  const min = Math.floor((now - date) / 60_000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  if (min < 24 * 60) return `${Math.floor(min / 60)}시간 전`;
  return `${date.getMonth() + 1}.${date.getDate()}`;
};
