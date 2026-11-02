// 조회 재시도 기준 (컨벤션 4-6) — 한 번만. 요청 제한(429)은 곧바로 다시 보내면 또 429 라 재시도하지 않는다
export const retryOnce = (count, error) => error?.response?.status !== 429 && count < 1;
