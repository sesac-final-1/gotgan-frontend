// 목업 데이터 생성 전용 — 화면 코드에서 import 하지 않는다 (API 로 교체되면 함께 사라짐)

// 결정적 난수 (데이터가 새로고침마다 바뀌지 않도록)
export function seeded(seed = 1) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];

// 날짜: 목업 기준일은 2026-10-01
export const TODAY = new Date('2026-10-01T10:00:00+09:00');
export const daysAgo = (d, h = 0) => new Date(TODAY.getTime() - d * 864e5 - h * 36e5);
