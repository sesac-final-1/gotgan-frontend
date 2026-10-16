# 곳간(GOTGAN) 코드 컨벤션

> 이 문서는 **규칙** 문서입니다. 규칙을 바꾸려면 팀 합의 후 이 문서를 수정하는 PR을 올립니다.
> 관련 문서: `project-spec.html`(무엇을 만드나) · `project-guideline.html`(왜 이렇게 만드나)

---

---

> **이 파일은 발췌본입니다.** 정본은 문서 사이트 컨벤션(https://gotganguide.vercel.app/convention)이고, 이 파일은 `gotgan-frontend`에 해당하는 프론트엔드 부분만 자동 추출한 것입니다. 규칙을 바꾸려면 정본(gotgan_guide 저장소 `content/project-convention.md`)을 고치고 `split-convention`을 다시 실행합니다.

---

## 0. 개요

### 0-1. 판단 원칙

- **"어떻게 쓰나"는 팀 기존 규칙 우선** — 코드 스타일 · 네이밍 · 응답 형식 · 예외 구조 · DB 규칙
- **"무엇을 만드나"는 프로젝트 스펙 유지** — 서비스 9개 + Keycloak · 엔드포인트 · 이벤트 · 인프라 구성
- **MSA 전용 규칙 추가** — 서비스 간 호출 · Resilience4j · 대시보드 조합 · 이벤트 · Saga · 멱등성 · 인프라 네이밍
- 규칙끼리 충돌하면 이 문서가 우선, 다른 문서는 이 문서에 맞춰 수정

### 0-2. 기존 컨벤션 대비 변경 사항

| 항목 | 기존(따숨) | 곳간 | 이유 |
|---|---|---|---|
| 패키지 | 도메인형, 엔티티는 `domain/` | 도메인형, 엔티티는 **`entity/`**, 서비스 호출용 **`client/`** 추가 | 팀 합의(엔티티 패키지명) · 서비스 간 HTTP 호출 |
| 보안 위치 | 각 앱 `common/security` | **게이트웨이에만** Spring Security, 업무 서비스는 `common/auth`(헤더 → 사용자) | 토큰 발급은 Keycloak, JWT 검증은 게이트웨이 한 곳 |
| 로그인 사용자 | `SecurityUtil.getMemberId()` | `@CurrentUser AuthUser` (게이트웨이가 넣은 `X-User-*` 헤더) | 업무 서비스에 SecurityContext 없음 |
| FK 제약 | 참조 컬럼 FK 필수 | **같은 서비스 안에서만 FK 필수**, 다른 서비스 ID는 논리 참조 + 인덱스 | DB per Service |
| 회원 테이블 · 패키지 | `member` · `member/` | **`users` · `user/`** | 서비스(user-service) · 스키마(userdb) 이름과 일치 |
| 테이블명 예외 | 단수형 | 단수형 유지, **`orders`**(예약어 `order`) · **`users`**(키워드 `user`)만 예외 | MySQL 예약어 · 키워드 |
| 에러 코드 | 번호형 `ORDER_003` | **의미형 `ORDER_OUT_OF_STOCK`** | 코드만 봐도 의미 · 로그 검색 |
| 시드 데이터 | `db/seed` V100~ | `db/seed/R__*.sql` (반복 실행) | 내용 수정 시 체크섬 오류 없음 |
| 프론트 언어 | TypeScript | **JavaScript** (`.js` / `.jsx`) | 목업 그대로 이식 · 입문자 부담 최소화 |
| 프론트 UI 키트 | shadcn/ui · recharts · sonner | **목업 컴포넌트 · 목업 SVG 차트 · 목업 토스트** | 목업 디자인 원칙 유지 |
| 프론트 관리자 | `features/admin` 공유 도메인 | **`features/admin`** — admin-service(`/api/admin/**`)만 호출, 담당 구지훈 | 백엔드 admin-service와 1:1 대칭, 담당 = 폴더 담당 |
| 프론트 페이지 | — | `pages/{shop,mypage,seller,admin}` | 4개 화면 영역 |

### 0-3. 확정 컨벤션 요약

팀 회의에서 확정한 8가지입니다. `project-spec.html`과 다르면 이 표가 우선합니다.

| # | 항목 | 확정 규칙 | 관련 절 |
|---|---|---|---|
| 1 | API 응답 형식 | 모든 응답을 `ApiResponse<T>` 봉투 `{ code, message, data }` 하나로 | 2-4 · 2-5 |
| 2 | 시간대 | DB · JDBC · JVM 모두 Asia/Seoul, 서비스 밖으로 나가는 이벤트 시각만 오프셋 포함 | 3-5 |
| 3 | 회원 테이블 · 패키지명 | 테이블 `users`, 패키지 `user/`, 엔티티 `User` | 2-1 · 3-2 |
| 4 | 생성 · 수정 시각 관리 | DB `DEFAULT` · `ON UPDATE`로 기록, 엔티티는 `@Generated`로 읽기만 | 3-5 |
| 5 | 에러 코드 형식 | 의미형 `{도메인}_{상황}` — `ORDER_OUT_OF_STOCK` | 2-5 |
| 6 | 프론트 언어 | JavaScript (`.js` / `.jsx`) — 목업 그대로 | 4-1 |
| 7 | 프론트 페이지 위치 | `pages/{shop · mypage · seller · admin}/` — 로직은 `features/` | 4-2 |
| 8 | Redis 키 이름 | `{용도}:{식별자}` — `cart:{userId}`(캐시, 원본은 `orderdb.cart_item`) · `blacklist:{jti}`(Could). 리프레시 토큰 키는 폐지(Keycloak이 관리) | 2-2 |

### 0-4. 10/12 추가 확정

| 항목 | 확정 규칙 | 관련 절 |
|---|---|---|
| 서비스 구성 | Spring 9개(gateway · user · store · product · order · payment · review · settlement · admin) + Keycloak | 2-1 · 3-2 |
| admin-service | DB 없는 조합 계층 — 관리자 API 진입점, 각 서비스 `/internal/**`을 호출해 조합만 | 2-1 · 2-4 · 2-7 |
| 카테고리 · 수수료 | 카테고리는 product-service, 카테고리별 수수료는 settlement-service | 2-1 · 3-2 |
| 대시보드 | 판매자는 store, 관리자는 admin 안에서 조합 — 병렬 호출 + 실패 영역만 빼고 부분 응답 | 2-7 |
| 서비스 간 호출 | Resilience4j 표준 (타임아웃 · 서킷 브레이커 · 멱등 GET만 재시도 · 폴백) | 2-7 |
| 동적 검색 | QueryDSL | 2-6 |
| XSS | 사용자 입력 HTML은 OWASP Java HTML Sanitizer로 저장 전 정화 | 2-6 |
| 코드 품질 | SonarQube Cloud — main 대상 PR에 품질 게이트 | 1-3 |
| (10/13) 저장소 3개 | `gotgan-backend`(services · serverless · docker-compose · docs/api) · `gotgan-frontend`(React 루트) · `gotgan-config`(deploy · infra/terraform · scripts · docs). 모노레포 폐지. 각 저장소 `docs/CONVENTION.md`는 이 문서의 발췌본(자동 생성) — 이 문서만 고친다 | 1-4 · 5-5 |
| (10/13) 시크릿 | **GitHub Secrets 단일 소스**(클러스터 · CI) · Vercel 환경 변수(프론트). Secrets Manager · KMS · ESO 없음. `secrets-sync` 워크플로가 K8s Secret 생성 | 1-5 · 5-3 |
| (10/13) 인프라 일일 스케줄 | `infra/terraform/cluster/`는 `infra-schedule` 워크플로가 매일 KST 07:00 apply(→ `bootstrap`) · 21:00 destroy. 나머지 폴더는 상시. apply/destroy는 워크플로 또는 구지훈 | 5-2 |
| (10/13) Redis 폴백 | 장바구니 원본은 MySQL `orderdb.cart_item`, Redis `cart:{userId}`는 캐시. Redis 호출은 서킷 인스턴스 `redisCart` + 폴백(MySQL) | 2-2 · 2-7 · 3-2 |
| (10/13 3차) 3티어(db 노드 분리 · NetworkPolicy) | 프론트(Vercel) → 백(EKS `app` 노드 그룹 t3.xlarge ×2 — 10/14 t3.large에서 조정) → DB(EKS `db` 노드 그룹 t3.medium ×1, 테인트 `tier=db:NoSchedule`, MySQL · Redis만). `02-networkpolicy.yaml`로 DB 3306 · 6379는 `tier=backend` 파드만. blackbox exporter 없음. 파일 업로드만 presigned URL로 브라우저 → S3 직접(예외) | 5-3 |

---

---

## 1. 공통 — Git · 협업

### 1-1. 브랜치

- `main` — 보호 브랜치. 직접 push 금지, PR + 승인 1명 + CI 통과 후 Squash merge
- 작업 브랜치: `feat/{도메인}-{작업}` (예: `feat/order-payment-verify`, `feat/infra-eks-cluster`)
- 그 외: `fix/` · `refactor/` · `docs/` · `chore/`(빌드 · 설정)
- 도메인 값: `auth` `user` `store` `product` `order` `payment` `review` `settlement` `admin` `gateway` `front`(프론트 공통) `infra`(Keycloak 설정 포함, 예: `feat/infra-keycloak-realm`) `cicd` `obs`(관측성) `sls`(서버리스)

### 1-2. 커밋 메시지

- Conventional Commits: `{type}({scope}): {요약}`
- type: `feat` `fix` `refactor` `docs` `test` `chore` `ci` `infra`
- scope: 서비스 · 영역 이름 (`order` `gateway` `front` `terraform` `helm` …)
- 요약은 한국어 명사형 종결, 50자 이내
- 예: `feat(order): 포트원 결제 검증 API` · `fix(front): 장바구니 무료배송 금액 계산` · `infra(terraform): NLB용 EIP 추가`

### 1-3. 이슈 · PR

- 이슈 제목: `[요구사항 ID] 작업` — 예: `[ORD-06] 결제 검증`
- PR 제목: 커밋 메시지 형식과 동일
- PR 본문 템플릿:
  - 개요 — 관련 요구사항 ID · 이슈 링크
  - 작업 내용 — 변경 사항 개조식
  - 테스트 — 확인 방법 (curl · 화면 · 테스트 코드)
  - 팀원 확인 사항 — 다른 팀원이 알아야 할 것
- **프론트 · 다른 서비스에 영향 있는 변경(응답 형식 · 에러 코드 · 이벤트 payload · API 경로)은 PR 제목에 `[영향]` 표시**, 영향받는 담당자 리뷰 필수
- PR 하나에 기능 하나, 변경 300줄 이하 권장
- main 대상 PR은 CI에서 **SonarQube Cloud 품질 게이트**를 통과해야 머지 (이슈는 PR 코멘트로 확인)

### 1-4. 폴더 소유권

- **다른 사람이 맡은 서비스 · `features/` 폴더는 PR 없이 수정 금지.** 연동이 필요하면 이슈로 요청
- 공유 파일(frontend `shared/api/queryKeys.js` · `app/router.jsx`, gotgan-config `deploy/k8s/01-configmap.yaml` · `deploy/helm/sesac-gojigi-app/values.yaml`)은 **도메인별 주석 구획 안에서만** 수정. `values.yaml`의 `tag` 줄은 backend CI만 커밋
- CODEOWNERS로 리뷰어 자동 지정

### 1-5. 시크릿

- `application.yml` · `.env` · YAML에 실제 비밀 값 커밋 금지 — `${환경변수}` 자리표시자만
- 비밀 값 위치: **GitHub Secrets**(클러스터 · CI — gotgan-config · gotgan-backend) · Vercel 환경 변수(프론트). Secrets Manager · KMS · ESO는 쓰지 않음
- 클러스터 시크릿은 gotgan-config의 `secrets-sync` 워크플로가 GitHub Secrets → K8s Secret으로 생성. Secret YAML 파일을 만들지 않음. 이름 · 용도는 `gotgan-config/docs/secrets.md`(값 없음), 값은 노션(팀 비공개)
- 비밀 아닌 값은 GitHub Variables(`AWS_ACCOUNT_ID` · `AWS_REGION` · `EKS_CLUSTER_NAME` · `DUCKDNS_DOMAIN`)
- 로컬은 `.env.local`(커밋 금지) 또는 docker-compose 기본값(`local-pass`). realm JSON · YAML에는 `${변수}` 자리표시자만
- 실수로 커밋했다면 즉시 팀 공유 → 키 폐기 · 재발급 (히스토리 삭제만으로는 부족)

---

---

## 4. 프론트엔드

### 4-1. 기술 스택별 규칙

| 분류 | 기술 | 규칙 |
|---|---|---|
| 언어 | JavaScript (ES2022) | 목업 그대로 — 컴포넌트 `.jsx`, 그 외 `.js`. TypeScript 도입 안 함 |
| 빌드 | Vite 6 · Node.js 22 LTS | `import.meta.env.VITE_*` |
| 라우팅 | React Router v7 (목업은 v6 — 이식하면서 올림) | 라우트 정의는 `app/router.jsx` **단일 파일** |
| 서버 상태 | TanStack Query v5 | API 데이터는 전부 여기서 (4-6) |
| 클라이언트 상태 | Zustand | `authStore` — accessToken · user · isAuthReady / UI 상태 |
| 표 | TanStack Table v8 | 4-7 |
| 폼 | react-hook-form + zod | 스키마는 `features/{domain}/schemas.js` |
| HTTP | Axios | `withCredentials: true` 고정 · 상대경로 `/api/...` |
| 스타일 | Tailwind CSS v4 | 디자인 토큰은 `styles/index.css`의 `@theme` (목업 토큰) |
| UI 컴포넌트 | 목업 공통 컴포넌트 | `shared/components/ui/` — shadcn 등 새 UI 키트 도입 안 함 |
| 차트 · 토스트 | 목업 SVG 차트 · 목업 ToastHost | 새 라이브러리 도입 시 팀 합의 |
| 결제 | `@portone/browser-sdk` | `features/order`에서만 |
| 목킹 | MSW | `src/mocks/` |
| 테스트 | Vitest + React Testing Library | 대상: 유틸 · zod 스키마 · 핵심 훅 |

### 4-2. 프로젝트 구조

도메인(기능) 기반 구조. **백엔드 서비스와 `features/{도메인}`이 대칭** (payment는 화면이 없어 `features/order`의 결제 흐름에 포함).

```
gotgan-frontend/src/
├── app/                          # 앱 전역
│   ├── router.jsx                #   전체 라우트 (단일 파일, 도메인별 주석 구획)
│   ├── providers.jsx             #   QueryClientProvider 등
│   ├── bootstrap.js              #   부팅 시 refresh 1회 → 로그인 상태 복구
│   └── App.jsx
├── pages/                        # 라우트 1개 = 페이지 파일 1개. features 조립만
│   ├── shop/                     #   메인 · 상품 · 스토어 · 장바구니 · 주문서 · 로그인 · 입점 신청
│   ├── mypage/                   #   주문 · 클레임 · 리뷰 · 회원정보 · 배송지 · 포인트
│   ├── seller/                   #   판매자센터
│   └── admin/                    #   관리자
├── features/                     # 도메인별 구현 (담당 경계 = 폴더 경계)
│   ├── auth/                     #   로그인 · 가입 · authStore · 가드
│   ├── user/                     #   회원정보 · 배송지 · 포인트 · 등급
│   ├── store/                    #   입점 신청 · 스토어 · 판매자 대시보드
│   ├── product/                  #   카테고리 · 상품 목록 · 상세 · 검색 · 판매자 상품
│   ├── order/                    #   장바구니 · 주문 · 결제 · 클레임 · 판매자 주문
│   ├── review/                   #   리뷰 · 상품문의 · 판매자 답글
│   ├── admin/                    #   관리자 화면 전부 (admin-service만 호출)
│   ├── support/                  #   FAQ (프론트 정적 데이터)
│   └── settlement/               #   판매자 정산
│       ├── api/                  #     settlementApi.js
│       ├── hooks/                #     useSettlementsQuery.js · usePaySettlementMutation.js
│       ├── components/
│       └── schemas.js            #     zod
├── shared/                       # 도메인에 속하지 않는 공통
│   ├── api/                      #   axiosInstance.js · queryKeys.js · refresh.js(single-flight)
│   ├── components/ui/            #   목업 공통 컴포넌트 (Pill · Price · Modal · Kpi · BarChart …)
│   ├── components/common/        #   RequireRole · ConfirmModal · EmptyState · SortableHeader
│   ├── layouts/                  #   ShopLayout · MyPageLayout · ConsoleLayout
│   ├── hooks/  stores/  utils/
├── mocks/                        # MSW handlers · fixtures
└── styles/index.css              # Tailwind 진입 · @theme 디자인 토큰
```

**운영 규칙**

1. **관리자 화면은 `features/admin`에 둔다** (입점 심사 · 스토어 · 카테고리 · 수수료 · 정산 · 회원 · 관리자 대시보드). `/api/admin/**`(admin-service)만 호출, 도메인 서비스 API를 직접 부르지 않음 — 담당 구지훈
2. 다른 사람의 `features/` 폴더는 PR 없이 수정 금지
3. 두 도메인 이상에서 쓰이면 `shared/`로 승격, 승격 시 팀 공지
4. `features` 간 직접 import 지양 — 필요하면 `shared` 경유
5. `shared/components/ui/`(목업 컴포넌트)는 수정 전 팀 공지 — 모든 화면에 영향

### 4-3. 라우트 · 권한 가드

| 경로 | 영역 | 접근 |
|---|---|---|
| `/` · `/products` · `/products/:id` · `/stores` · `/store/:id` | 쇼핑몰 | 공개 |
| `/login` · `/signup` | 인증 | 공개 |
| `/cart` · `/checkout` · `/order/complete` · `/seller/apply` | 쇼핑몰 | BUYER |
| `/mypage/**` (`/mypage/points` 포함) | 마이페이지 | BUYER |
| `/seller` · `/seller/**` | 판매자센터 | SELLER |
| `/admin` · `/admin/**` | 관리자 | ADMIN |

- 가드: `<RequireRole role="SELLER">` — **`authStore.user.roles`로 판단** (토큰 직접 디코딩 안 함)
- `isAuthReady` 이전에는 판단하지 않음 (새로고침 시 잘못된 리다이렉트 방지)
- **프론트 가드는 UX 장치일 뿐, 실제 접근 제어는 게이트웨이 · 서비스**
- `router.jsx`는 영역 · 도메인별 주석 구획에만 추가, catch-all(`*`)은 항상 맨 마지막

### 4-4. 인증

| 항목 | Access Token | Refresh Token |
|---|---|---|
| 발급 | Keycloak (user-service가 대리 호출) | Keycloak (user-service가 대리 호출) |
| 저장 | `authStore`(Zustand) 메모리 | HttpOnly · Secure · SameSite=Strict 쿠키, `Path=/api/auth` (JS 접근 불가) |
| 전송 | `Authorization: Bearer {AT}` | 브라우저 자동 (같은 출처 · Vercel rewrite) |
| 서버 저장 | 없음 (즉시 로그아웃 `blacklist:{jti}`는 Could) | Keycloak 세션 (user-service 경유) — Redis에 두지 않음 |
| 재발급 | `POST /api/auth/refresh` | Keycloak 로테이션 |
| 수명 | 30분 | 14일 |

- 로그인 화면은 React 자체 폼 — Keycloak 로그인 페이지로 리다이렉트하지 않음
- 부팅: `app/bootstrap.js`가 `/api/auth/refresh`를 1회 호출 → 성공 시 로그인 복구, 401이면 비로그인 상태
- AT 만료(401): axios 응답 인터셉터가 single-flight(`shared/api/refresh.js`)로 재발급 후 원 요청 재시도
- AT를 `localStorage` · `sessionStorage`에 저장 금지. RT는 프론트 코드에서 다루지 않음
- 판매자 전환(입점 승인) 후에는 refresh로 새 roles를 받음

### 4-5. 네이밍

| 대상 | 규칙 | 예시 |
|---|---|---|
| 컴포넌트 파일 | PascalCase | `ProductCard.jsx` |
| 페이지 컴포넌트 | `~Page` 접미사 필수, 영역 접두어 | `SellerOrderListPage.jsx` · `AdminApplicationDetailPage.jsx` |
| 커스텀 훅 | `use` 접두사, 조회 `use{X}Query` · 변경 `use{행위}Mutation` | `useCartQuery` · `useShipOrderItemsMutation` |
| API 모듈 | `{도메인}Api.js`, 함수는 `get` / `create` / `update` / `delete` + 업무 동사 | `orderApi.js` → `getMyOrders()` · `confirmPurchase()` |
| zod 스키마 | `{이름}Schema` | `storeApplySchema` |
| Zustand 스토어 | `use{X}Store`, 파일 `{x}Store.js` | `useAuthStore` |
| 상수 | UPPER_SNAKE | `PAYMENT_TIMEOUT_MINUTES` |
| queryKey | `shared/api/queryKeys.js` 팩토리에서만 (즉석 배열 금지) | `queryKeys.orders.my(params)` |
| 함수 형태 | 컴포넌트 · 훅 · 최상위 = `function` 선언문, 내부 핸들러 = 화살표 함수 `handle{Event}` | `const handleShipClick = () => {}` |
| 이벤트 props | `on{Event}` | `onConfirm` |

### 4-6. TanStack Query 패턴

세 가지를 그대로 따릅니다.
**① queryKey는 팩토리에서만 ② API 함수는 `{도메인}Api.js`로 분리 ③ 컴포넌트는 `function` 선언문 + 내부 핸들러는 화살표 함수**

**① queryKey 팩토리 — 도메인별 구획**

```js
// shared/api/queryKeys.js
export const queryKeys = {
  // ── product ──────────────────────
  products: {
    all: () => ['products'],
    list: (filters) => ['products', 'list', filters],
    detail: (id) => ['products', 'detail', id],
    seller: (params) => ['products', 'seller', params],
  },
  // ── order ────────────────────────
  cart: { all: () => ['cart'] },
  orders: {
    my: (params) => ['orders', 'my', params],
    detail: (orderNo) => ['orders', 'detail', orderNo],
    sellerItemsAll: () => ['orders', 'seller-items'],               // 무효화용 상위 키
    sellerItems: (params) => ['orders', 'seller-items', params],
  },
  // ── settlement · store · user ── (각 도메인 구획에만 추가)
};
```

- 컴포넌트에서 `useQuery({ queryKey: ['orders', params] })`처럼 즉석 배열 금지 — 무효화가 조용히 실패
- 자기 도메인 구획 안에서만 추가 · 수정

**② API 함수**

```js
// features/order/api/orderApi.js
import { axiosInstance } from '@/shared/api/axiosInstance';

export async function getOrderDetail(orderNo) {
  const { data } = await axiosInstance.get(`/api/orders/${orderNo}`);
  return data.data; // ApiResponse 봉투에서 data만 꺼낸다
}
```

**③ 조회 · 변경**

```js
// features/order/hooks/useOrderDetailQuery.js
export function useOrderDetailQuery(orderNo) {
  return useQuery({
    queryKey: queryKeys.orders.detail(orderNo),
    queryFn: () => getOrderDetail(orderNo),
  });
}

// features/order/hooks/useShipOrderItemsMutation.js
export function useShipOrderItemsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request) => shipOrderItems(request),
    onSuccess: () => {
      // 상위 키로 무효화하면 필터 · 페이지가 다른 목록까지 모두 새로 고침된다
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.sellerItemsAll() });
    },
  });
}
```

| 상황 | 사용 |
|---|---|
| 조회 (목록 · 상세) | `useQuery` |
| 변경 (생성 · 수정 · 삭제 · 상태 변경) | `useMutation` + 성공 시 `invalidateQueries` |
| 장바구니 수량처럼 즉시 반영이 필요한 변경 | `useMutation` + 낙관적 업데이트 (실패 시 롤백) |
| 무한 스크롤 · 더보기 | `useInfiniteQuery` (페이지 형식 `PageResponse` 기준) |
| 판매자 새 주문 확인 | `refetchInterval: 30_000` |
| 401 → 재발급 | axios 인터셉터 (`shared/api/axiosInstance.js`) |

- 예외: 성공 후 화면을 떠나는 인증 액션(로그인 · 로그아웃 · 비밀번호 변경)과 **포트원 결제 흐름**(`requestPayment` → 결제 검증)은 API 함수 직접 호출 허용. 끝난 뒤 필요한 queryKey만 무효화
- 에러 메시지는 `error.response.data.message`(ApiResponse) 사용, 코드별 분기는 `code`로

### 4-7. TanStack Table 규칙

- **데모 규모(수백 건 이하) 목록은 전체 1회 로드 + 클라이언트에서 검색 · 정렬 · 페이징** (관리자 입점 심사 · 스토어 · 회원 · 정산, 판매자 상품)
- 건수가 계속 늘어나는 목록(판매자 주문, 구매자 상품 목록)은 **서버 페이징**(`manualPagination` · `manualSorting`)
- 정렬 헤더는 `shared/components/common/SortableHeader.jsx` 재사용
- **`state`에 넘기는 배열 · 객체는 `useMemo`, 함수는 컴포넌트 바깥(모듈 스코프) 또는 `useCallback`** — 매 렌더링 새 참조를 넘기면 무한 루프로 브라우저가 멈춤

```jsx
// 금지 — 렌더링마다 새 배열 · 새 함수
state: { columnFilters: status === 'ALL' ? [] : [{ id: 'status', value: status }] },
globalFilterFn: (row, id, value) => { /* ... */ },

// 올바름
function globalFilterFn(row, columnId, filterValue) { /* ... */ }   // 모듈 스코프

function AdminStoreListPage() {
  const columnFilters = useMemo(
    () => (status === 'ALL' ? [] : [{ id: 'status', value: status }]),
    [status],
  );
  const table = useReactTable({ data, columns, state: { columnFilters }, globalFilterFn /* ... */ });
}
```

- 정렬 기준과 화면 표시가 다르면 `accessorFn`(정렬용 값) + `cell`(표시) 분리
- 로딩 · 에러 · 빈 상태는 **`<tbody>` 안의 행 하나**로 표현 — 검색창 등 다른 UI가 사라졌다 생기며 포커스를 잃지 않게
- 일괄 처리(발주확인 · 송장)는 `getSelectedRowModel()`로 선택 행 ID만 서버에 전송

### 4-8. 스타일

- 목업 디자인 원칙 유지: 각진 모서리 · 1px 선 · 먹색 + 주홍 포인트 하나 · 그림자는 드롭다운/모달만 · 숫자는 모노스페이스 + `tabular-nums`
- 색 · 간격은 `@theme` 토큰 클래스로만 (임의 hex 값 금지)
- 공통 클래스(`.btn` · `.field` · `.panel` · `.tbl` · `.num`)를 먼저 쓰고, 없을 때만 유틸 조합
- 한국어 줄바꿈 `word-break: keep-all`, 375px에서 가로 스크롤 없음

### 4-9. 트러블슈팅

- **새로고침하면 로그아웃됨** — ① `bootstrap.js`의 refresh 호출 완료 여부 ② 가드가 `isAuthReady` 전에 판단하는지 ③ `authStore`에 AT가 들어갔는지
- **401 후 자동 재발급이 안 됨** — ① Network 탭에 refresh 요청이 찍히는지 ② `axiosInstance`를 거치지 않는 별도 axios 호출이 있는지
- **CORS 에러** — 절대경로(`http://...`)로 호출하고 있지 않은지. 로컬은 Vite 프록시, 배포는 Vercel rewrite — 항상 상대경로 `/api/...`
- **`import.meta.env.VITE_...`가 undefined** — `VITE_` 접두사, `.env.local` 수정 후 dev 서버 재시작, Vercel은 환경 변수 추가 후 재배포
- **포트원 결제창이 안 뜸** — storeId · channelKey 환경 변수, 테스트 채널 키인지, 브라우저 팝업 차단

---

---

## 6. 리뷰 체크리스트

**프론트엔드**

- [ ] 컴포넌트는 `.jsx`, 그 외는 `.js`인가? (TypeScript 파일이 섞이지 않았는가)
- [ ] 페이지는 `pages/`, 로직은 `features/{도메인}`에 있는가? 관리자 화면은 `features/admin`에서 `/api/admin/**`만 호출하는가?
- [ ] queryKey를 팩토리에서만 만들었는가?
- [ ] 변경 후 관련 queryKey를 무효화하는가?
- [ ] 서버 데이터를 Zustand에 복사하지 않았는가?
- [ ] TanStack Table `state`의 배열 · 함수 참조가 안정적인가?
- [ ] 로딩 · 에러 · 빈 상태를 처리했는가?
- [ ] 목업 디자인 토큰 · 공통 클래스를 썼는가? 375px에서 깨지지 않는가?
- [ ] 다른 도메인 `features/`를 수정하지 않았는가?

