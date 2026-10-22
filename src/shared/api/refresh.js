// single-flight 재발급 — 동시에 여러 곳(부팅 · 401 인터셉터 · 소셜 콜백)에서 불러도 /api/auth/refresh 는 한 번만 (컨벤션 4-4)
// Refresh Token 은 쓸 때마다 바뀌어서(로테이션) 두 번 보내면 늦게 간 쪽이 이미 쓴 토큰으로 실패한다
let pending = null;

export function refreshOnce(doRefresh) {
  if (!pending) {
    pending = Promise.resolve()
      .then(doRefresh)
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}
