// queryKey 팩토리 — 컴포넌트에서 즉석 배열 금지 (컨벤션 4-6). 공유 파일: 도메인별 구획 안에서만 수정
export const queryKeys = {
  // ── admin (구지훈)
  admin: {
    all: ['admin'],
  },

  // ── user (이경석)
  user: {
    all: ['user'],
  },

  // ── store (박지연)
  store: {
    all: ['store'],
  },

  // ── product (박지연)
  product: {
    all: ['product'],
  },

  // ── order (이경석)
  order: {
    all: ['order'],
  },

  // ── review (이경석)
  review: {
    all: ['review'],
  },

  // ── settlement (구지훈)
  settlement: {
    all: ['settlement'],
  },
};
