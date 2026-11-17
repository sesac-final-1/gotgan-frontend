// 방문자 ID(11/17) — 브라우저마다 무작위 값 하나. 관리자 화면 "현재 접속자"가 로그인 전후를 같은 사람으로, 같은 와이파이의 여러 명은 따로 세게 한다.
// 개인 정보가 아닌 무작위 값이고 localStorage 에 둔다(막혀 있으면 이 탭에서만 쓰는 값). 게이트웨이 ActiveUserFilter 가 X-Gotgan-Visitor 로 받는다
const KEY = 'gotgan-visitor';
export const VISITOR_HEADER = 'X-Gotgan-Visitor';
let memo = null;

const random = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);

export function visitorId() {
  if (memo) return memo;
  try {
    memo = localStorage.getItem(KEY);
    if (!memo) {
      memo = random();
      localStorage.setItem(KEY, memo);
    }
  } catch {
    memo = random();
  }
  return memo;
}
