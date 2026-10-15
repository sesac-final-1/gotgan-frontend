// 별점 요약 (평균 · 분포) — 담당 이경석
export function ratingSummary(list) {
  const dist = [5, 4, 3, 2, 1].map((s) => ({ star: s, count: list.filter((r) => r.rating === s).length }));
  const avg = list.length ? list.reduce((a, r) => a + r.rating, 0) / list.length : 0;
  return { avg, dist, total: list.length };
}
