// 화면 공통 포맷 · 클래스 유틸 (목업 lib/format.js 이식). 목업 데이터 전용(시드 난수 · 기준일)은 src/mocks/fixtures/_seed.js
export const won = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`;
export const comma = (n) => Math.round(n).toLocaleString('ko-KR');
export const pct = (r, d = 0) => `${(r * 100).toFixed(d)}%`;

/** 1억 이상은 '억', 1만 이상은 '만' 단위로 줄여 표기 */
export const shortWon = (n) => {
  if (n >= 1e8) return `${(n / 1e8).toFixed(n >= 1e9 ? 0 : 1)}억`;
  if (n >= 1e4) return `${comma(n / 1e4)}만`;
  return comma(n);
};

export const salePrice = (p) => Math.round((p.price * (1 - (p.discount || 0))) / 10) * 10;

export const maskName = (name) => (name.length <= 2 ? name[0] + '*' : name[0] + '*'.repeat(name.length - 2) + name.at(-1));

const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
export const ymdhm = (d) => `${ymd(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const md = (d) => `${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;

export const cx = (...a) => a.filter(Boolean).join(' ');
