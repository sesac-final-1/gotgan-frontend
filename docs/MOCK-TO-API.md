# 목업 → 실제 API 교체 가이드

지금 화면은 전부 **목업 데이터**로 동작한다. 백엔드 API가 준비되면 아래 순서대로 교체한다.
목표는 **화면(컴포넌트) 수정 0줄** — 바꾸는 곳은 `features/{도메인}/api/*Api.js` 함수 본문이 대부분이다.

## 1. 구조 — 어디를 바꾸나

```
화면 컴포넌트  →  조회 훅 use{X}Query / 변경 훅 use{X}Mutation  →  api 함수 fetch{X}  →  (지금) mockResolve(목업)
features/*/components      features/*/hooks                        features/*/api          (나중) axiosInstance
```

| 계층 | 파일 | 교체할 때 |
|---|---|---|
| api 함수 | `features/{도메인}/api/{도메인}Api.js` | **본문만** `axiosInstance` 호출로 바꾼다 (함수 이름 · 인자 유지) |
| 훅 | `features/{도메인}/hooks/use*.js` | 보통 그대로. 서버 페이징 전환 · 변경 mutation 추가 때만 |
| 화면 | `features/{도메인}/components/*` · `pages/*` | 그대로 (응답 필드 이름이 목업과 다를 때만) |
| 목업 | `src/mocks/` | 도메인 교체가 끝나면 해당 fixture import 가 없어진다 — 마지막에 폴더째 삭제 |

## 2. 기본 교체 — 조회

```js
// 전 (목업)
// TODO(박지연): return (await axiosInstance.get('/api/categories')).data;
export const fetchCategories = () => mockResolve(categories);

// 후
import { axiosInstance } from '@/shared/api/axiosInstance';
export const fetchCategories = async () => (await axiosInstance.get('/api/categories')).data;
```

- 각 함수 위의 `TODO(담당자)` 주석에 엔드포인트가 적혀 있다 — `grep -rn "TODO(내이름)" src` 로 내 몫을 찾는다
- 응답 필드 이름은 **목업 필드 이름에 맞춰** DTO 를 만들면 화면을 안 고쳐도 된다. 다르게 가야 하면 api 함수에서 변환하고, 화면은 건드리지 않는다
- 날짜: 목업은 `Date` 객체. 실제 응답은 ISO 문자열이므로 api 함수에서 `new Date()` 로 바꿔 넘기거나, 화면의 `format.js` 함수가 문자열도 받는지 확인
- 경로는 상대경로 `/api/...` — 로컬은 Vite 프록시(8080), 운영은 Vercel rewrite → `https://api.gotgan.click`

## 3. 변경 — mutation 추가

지금 변경 동작(저장 · 승인 · 발송 등)은 대부분 **토스트 + 로컬 상태**로 흉내만 내고, 핸들러마다 필요한 훅 이름을 적어 두었다.

```js
toast('발주확인했어요'); // TODO(이경석): useConfirmOrderItemsMutation
```

예시 구현: `features/admin/hooks/useDecideApplicationMutation.js` (입점 승인 · 반려 — 실제로 목록 · 배지 · 이력이 갱신되는 유일한 화면)

```js
export function useConfirmOrderItemsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: confirmOrderItems,                                               // api 파일에 함수 추가
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.order.all }),   // 관련 목록 다시 불러오기
  });
}
```

- 화면에서는 로컬 상태(`patch` · `setDone` 등)와 토스트를 지우고 `mutate()` → `onSuccess` 에서 토스트
- queryKey 는 `shared/api/queryKeys.js` 에 이미 도메인별로 정의돼 있다. 새 키는 거기에만 추가 (화면에 배열 직접 쓰기 금지)

## 4. 목록 표 — 클라이언트 / 서버 페이징 (컨벤션 4-7)

모든 목록 표는 `useClientTable` + `DataTable` + `SearchInput` + `BlockPager` (검색 · 정렬 토글 · 블록 페이저 `<< < 1~10 > >>`).

| 목록 | 방식 | 이유 |
|---|---|---|
| 판매자 주문(`SellerOrderList`) · 구매자 상품 목록(`ShopProductList`) | **서버 페이징** | 운영 시 건수가 계속 늘어남 |
| 그 밖의 전부 | 클라이언트 (전체 1회 로드 → 화면에서 검색 · 정렬 · 페이징) | 데모 규모 · 수백 건 이하 |

서버 페이징 전환 (두 화면 맨 위에 TODO 있음):

1. api 함수가 `params({ page, size, sort, q, status })` 를 받아 `GET ...?page&size&sort` 호출, 응답 `{ content, totalPages, totalElements }`
2. 훅은 이미 `useSellerOrderItemsQuery(params)` 처럼 params 를 queryKey 에 넣는다 — 그대로 사용, `placeholderData: keepPreviousData` 추가
3. 화면: `useReactTable` 에 `manualPagination · manualSorting · manualFiltering: true`, `pageCount: data.totalPages`, `state` 의 pagination · sorting · 검색어를 params 로 넘김
4. `BlockPager` 는 그대로 (pageIndex · pageCount · onPage 만 받음 — 클라이언트 · 서버 공용)

## 5. 특수 케이스

### 계산 필드 — ✅ 끝 (`orderCalc.js` 삭제)

주문 금액 · 배송비 · 포인트 · 배송 추적은 주문 · 장바구니 응답 필드(`totalProductAmt · totalShippingFee · usedPoint · payAmt · earnedPoint`, 상품주문 시각)를 쓴다. 프론트에서 금액을 계산하지 않는다 — 결제 금액은 서버가 기준.

### 장바구니 — ✅ 끝 (`features/order/hooks/useCart.js`, `cartMockStore` 삭제)

`GET /api/carts` + 담기 · 수량 · 선택 · 삭제(`POST · PATCH · DELETE /api/carts/items`). 반환 `{ cart, lines, cartCount, addToCart(items), setQty, toggleLine, toggleAll, removeLines }` — 필드는 API 이름(`productOptionId · quantity · checked · lineAmt`, 스토어 묶음 `stores[]`).
상품 상세의 담기는 구매자 상품 API(옵션 ID)가 나오면 연결 (`ShopProductDetail` TODO).

### 알림 · 채팅 — 처음부터 실제 API (목업 없음, 10/27 · 구지훈)

교체할 것이 없다 — `mocks/` 를 쓰지 않고 처음부터 실제 API 로 만들었다.

| 기능 | api · 훅 | 화면 · 경로 | 계약 |
|---|---|---|---|
| 알림 센터 | `notification/api/notificationApi.js` · `useNotificationsQuery` · `useUnreadCountQuery` · `useReadNotificationMutation` · `useNotificationStream` | 헤더 · 판매자센터 · 관리자 콘솔의 알림 벨 `NotificationBell` (목록 · 안 읽은 수 · 모두 읽음 · 새 알림 토스트) | backend `docs/api/admin.md` 5절 |
| 1:1 채팅 | `chat/api/chatApi.js` · `useChatQueries` · `useChatRoomSocket` · `chat/realtime/chatSocket.js` | `/mypage/chats(/:roomId)` '1:1 채팅' · `/seller/chats(/:roomId)` '채팅' · `/admin/chats(/:roomId)` '상담함' | backend `docs/api/chat.md` |

- REST 는 다른 도메인처럼 상대경로(`/api/notifications/**` · `/api/chats/**`). 실시간만 배포에서 `api.gotgan.click` 에 직접 연결한다 — SSE `https://api.gotgan.click/api/notifications/stream`(`@microsoft/fetch-event-source`, Authorization 헤더), WebSocket `wss://api.gotgan.click/ws/chat`(STOMP, 토큰은 CONNECT 프레임). 로컬은 Vite 프록시
- 알림 SSE 로 `CHAT_MESSAGE` 가 오면 채팅 queryKey(`queryKeys.chat.all`)를 무효화해 채팅 목록 · 배지를 갱신한다
- 채팅 진입 버튼: 상품 상세 '판매자에게 문의' · 고객센터 '운영팀과 채팅' · 판매자센터 채팅 '운영팀에 문의' · 관리자 스토어 상세 '판매자와 상담' · 스토어 톡 안 '운영팀에 도움 요청' (`OpenChatButton`)

### 임시 훅 — 응답에 필드가 들어오면 삭제

| 임시 | 어디서 | 대신 필요한 것 | 담당 |
|---|---|---|---|
| `useSellerBuyersQuery` (order) | 판매자 대시보드 · 리뷰 · 문의 · 주문상세 | 판매자 리뷰 · 문의 응답에 작성자명(마스킹), 주문상세 응답에 구매자 요약 | 이경석 |
| `r.author ?? 기본값` | 구매자 상품 리뷰 · 문의 · 메인 포토 리뷰 | 리뷰 · 문의 응답에 `author { name, nick, avatar, grade }` | 이경석 |

화면 영역마다 부를 수 있는 API가 정해져 있다 (컨벤션 4-2 규칙 1): 관리자 화면 → `/api/admin/**` 만, 판매자 화면 → `/api/seller/**` · 공개 API. 임시 훅도 이 규칙을 지키도록 영역별로 따로 뒀다.

### 필드명 — 화면을 API 이름으로 바꾼다 (10/20 결정 6번 A안)

목업과 API 의 필드명이 다르면 **어댑터로 옛 이름에 맞추지 않고, 교체할 때 화면 · 훅을 API 이름으로 바꾼다** (이름은 한 벌만). 다른 도메인도 같은 방식.

정산(`/api/seller/settlements` · `/api/admin/settlements`, 계약 backend `docs/api/settlement.md`) 대응표:

| 목업 | API | 비고 |
|---|---|---|
| `orders` | `itemCount` | 정산 대상 상품주문 수 — 이 중 지난 주차 이월분 `carriedOverCount`("이월 n건" 표시) |
| `gross` | `salesAmt` | 구매확정 매출 |
| `refund` | (없음) | 정산은 구매확정 이후만 다룸 — 환불 · 취소 행 삭제 |
| `commission` | `commissionAmt` | 판매수수료 |
| `pgFee` | `paymentFeeAmt` | 결제수수료 2.2% |
| `payout` | `payoutAmt` | 지급액 = 매출 − 판매수수료 − 결제수수료 |
| `rate` | 상세 `items[].rate` | 율은 상세 항목에만 (상위 카테고리별) |
| `start` · `end` (Date) | `weekStart` · `weekEnd` (`YYYY-MM-DD`) · `week`(`2026-W43`) | 주차 선택은 `week` |
| `pay` (Date) | `scheduledPayDate` | 다음 주 목요일 |
| `status` 한글(지급예정 · 지급보류 · 지급완료) | `SCHEDULED` · `HELD` · `PAID` | 표시 문구는 화면에서 매핑 |
| `bank` 문자열 | `bank { bankName, accountNumber, accountHolder }` | |
| `id` `ST-S1-0921` | `id` (숫자) | |

- 쓰는 화면: `SellerSettlementList`(구지훈) · 관리자 `SettlementList` · `AdminDashboard` · `StoreDetail` · `StoreList`(관리자 — admin 구현 때 함께) · 판매자 `SellerDashboard`(박지연, 정산 수치는 `/internal/stats/settlements` 조합)
- 대시보드 기준: "얼마 팔렸나"는 구매확정일, "얼마 받나 · 줬나"는 정산서 기준 — 이월 때문에 주차 합이 다를 수 있음

### 인증 — `shared/api/axiosInstance.js`

Authorization 헤더 · 401 시 single-flight refresh 재시도는 TODO(이경석). 로그인 · 회원가입 화면(`ShopLogin` · `ShopSignup`)은 지금 토스트만.

## 6. 담당 · 파일

| 담당 | api 파일 | 화면 (components) | TODO 수 |
|---|---|---|---|
| 구지훈 | `admin/api/adminApi.js` · `settlement/api/settlementApi.js` (+ 결제 PortOne) | 관리자 전체 · 판매자 정산 | 24 |
| 이경석 | `user/api/userApi.js` · `order/api/orderApi.js` · `review/api/reviewApi.js` (+ auth) | 마이페이지 · 장바구니 · 주문 · 리뷰 · 문의 · 로그인 · 판매자 주문/클레임/리뷰/문의 | 41 |
| 박지연 | `product/api/productApi.js` · `store/api/storeApi.js` | 상품 목록 · 상세 · 스토어 · 입점 신청 · 판매자 상품/대시보드/스토어 설정 | 18 |

> 교체 순서 권장: 조회(api 본문) → 화면 확인 → mutation 추가 → 임시 훅 · 계산 필드 정리 → 마지막 도메인이 끝나면 `src/mocks/` 삭제

## 7. 확인

```bash
npm run lint && npm test && npm run build
```

- 교체한 화면을 브라우저에서 열어 로딩 → 데이터 → 검색 · 정렬 · 페이저 → 변경 후 목록 갱신까지 확인
- `grep -rn "mocks/" src/features/{도메인}` 결과가 비면 그 도메인 교체 완료
