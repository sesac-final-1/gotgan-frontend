// queryKey 팩토리 — 컴포넌트에서 즉석 배열 금지 (컨벤션 4-6). 공유 파일: 도메인별 구획 안에서만 수정
// 목업 단계에서 화면 이식용 키를 미리 정의했다 — API 로 바꿔도 키는 그대로 쓴다
export const queryKeys = {
  // ── admin (구지훈) — /api/admin/** (admin-service)
  admin: {
    all: ['admin'],
    dashboard: () => ['admin', 'dashboard'],
    applications: () => ['admin', 'applications'],
    application: (id) => ['admin', 'applications', id],
    stores: () => ['admin', 'stores'],
    users: () => ['admin', 'users'],
    user: (userId) => ['admin', 'users', userId], // users() 아래라 목록을 무효화하면 상세도 함께
    userPoints: (userId) => ['admin', 'users', userId, 'points'],
    settlements: () => ['admin', 'settlements'],
    settlement: (id) => ['admin', 'settlements', 'detail', id],
    settlementWeek: (week) => ['admin', 'settlements', 'week', week ?? 'last'], // settlements() 아래라 목록을 무효화하면 함께
    reviews: () => ['admin', 'reviews'],
    reports: () => ['admin', 'reports'],
    report: (type, id) => ['admin', 'reports', type, id], // reports() 아래라 처리 후 목록을 무효화하면 상세도 함께
    categories: () => ['admin', 'categories'],
    products: () => ['admin', 'products'],
    storeProducts: (storeId) => ['admin', 'stores', storeId, 'products'], // 실제 API — 판매중지 후 이 키만 무효화
  },

  // ── user (이경석)
  user: {
    all: ['user'],
    me: () => ['user', 'me'],
    addresses: () => ['user', 'addresses'],
    points: () => ['user', 'points'],
  },

  // ── store (박지연)
  store: {
    all: ['store'],
    list: () => ['store', 'list'],
    mine: () => ['store', 'mine'],
    sellerDailySales: () => ['store', 'seller', 'daily-sales'],
  },

  // ── product (박지연)
  product: {
    all: ['product'],
    categories: () => ['product', 'categories'],
    list: () => ['product', 'list'],
  },

  // ── order (이경석)
  order: {
    all: ['order'],
    my: () => ['order', 'my'],
    cart: () => ['order', 'cart'], // 장바구니 — 담기 · 수량 · 선택 · 삭제 · 결제 완료 뒤 무효화
    myOrder: (orderNo) => ['order', 'my', orderNo], // my() 아래라 목록을 무효화하면 상세 · 환불 예정액도 함께
    claimPreview: (orderNo, params) => ['order', 'my', orderNo, 'claim-preview', params],
    myClaims: () => ['order', 'my', 'claims'], // my() 아래 — 클레임 신청 뒤 함께 무효화
    seller: () => ['order', 'seller'], // 판매자 처리(발주확인 · 송장 · 배송완료) 뒤 목록 · 상세를 함께 무효화
    sellerItems: (params) => ['order', 'seller', 'items', params ?? {}], // 서버 페이징 대상 (컨벤션 4-7)
    sellerItem: (orderItemId) => ['order', 'seller', 'item', String(orderItemId)],
    sellerClaims: (params) => ['order', 'seller', 'claims', params ?? {}], // seller() 아래 — 서버 페이징
    sellerItemsMock: () => ['order', 'seller-mock'], // 임시 — 대시보드 최근 주문 (대시보드 연동 때 삭제)
    sellerBuyers: () => ['order', 'seller', 'buyers'], // 임시 — 응답에 작성자 · 구매자 요약이 들어오면 삭제
  },

  // ── review (이경석)
  review: {
    all: ['review'],
    list: () => ['review', 'list'],
    qnas: () => ['review', 'qnas'],
    my: () => ['review', 'my'], // 마이페이지 — 작성 · 수정 · 삭제 뒤 내가 쓴 리뷰 · 작성 가능 목록을 함께 무효화
    myList: () => ['review', 'my', 'list'],
    writable: () => ['review', 'my', 'writable'],
    productList: (params) => ['review', 'product', 'list', params], // 상품 상세 공개 리뷰 — 서버 페이징
    productSummary: (productId) => ['review', 'product', 'summary', productId],
  },

  // ── settlement (구지훈)
  settlement: {
    all: ['settlement'],
    seller: () => ['settlement', 'seller'],
    sellerDetail: (id) => ['settlement', 'seller', 'detail', id],
    sellerPending: () => ['settlement', 'seller', 'pending'],
  },

  // ── notification (구지훈) — 알림 센터 /api/notifications/** (admin-service)
  notification: {
    all: ['notification'],
    list: () => ['notification', 'list'],
    unread: () => ['notification', 'unread'],
  },

  // ── chat (구지훈) — 1:1 채팅 /api/chats/** (chat-service)
  chat: {
    all: ['chat'],
    rooms: (filter) => ['chat', 'rooms', filter ?? {}],
    messages: (roomId) => ['chat', 'messages', roomId],
    unread: () => ['chat', 'unread'],
  },

  // ── payment (구지훈) — 포트원 결제창 · 결제 확인
  payment: {
    all: ['payment'],
    redirect: (orderNo, search) => ['payment', 'redirect', orderNo, search], // 모바일 리다이렉트 결과 → 결제 확인
  },
};
