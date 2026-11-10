# 곳간 GOTGAN — frontend

곳간 프로젝트의 **React 앱** 저장소입니다(Vercel 배포). 백엔드는 [gotgan-backend](https://github.com/sesac-final-1/gotgan-backend), 인프라 · 배포는 [gotgan-config](https://github.com/sesac-final-1/gotgan-config), 설계 문서는 https://gotganguide.vercel.app/ 입니다.

## 상태

목업([gotgan_expage](https://mockup-page-sable.vercel.app/))을 **JavaScript · React 18 · Vite 6 · Tailwind 4 · TanStack Query v5 · TanStack Table v8 · Zustand · React Router v7** 로 이식했고, **모든 화면이 실제 API** 에 연결돼 있습니다 — `src/mocks/` 는 11/3 삭제(컨벤션 4장 · 가이드라인 14장). 테스트는 Vitest + React Testing Library 60개 파일 · 657개(`npm test`, 11/10).

## 구조

```
gotgan-frontend/
├── vercel.json              /api/* → https://api.gotgan.click rewrite · SPA 새로고침 · 보안 헤더(CSP 강제 · HSTS · X-Frame-Options 등)
├── vite.config.js           로컬 /api · /ws(채팅 STOMP) 프록시 → localhost:8080 (gateway) · Vitest 설정
├── .env.example             VITE_PORTONE_STORE_ID · VITE_PORTONE_CHANNEL_KEY (값은 Vercel 환경 변수)
└── src/
    ├── app/                 router.jsx(라우트 표 + 지연 로딩) · RootLayout · RouteError · providers.jsx · bootstrap.js(부팅 시 refresh 1회)
    ├── pages/{shop,mypage,seller,admin}/   라우트 1개 = 파일 1개, features 조립만
    ├── features/{auth,user,store,product,order,review,settlement,payment,admin,support,chat,notification,report}/
    │   └── api/ · hooks/ · components/ (+ schemas.js · stores/ · utils/ 필요한 곳만)
    ├── shared/              api/(axiosInstance · queryKeys · refresh · retry) · components/{ui,common} · layouts · hooks · stores · utils
    ├── test/setup.js        Vitest 공통 설정 (jest-dom)
    └── styles/index.css     Tailwind 진입 · @theme 디자인 토큰 (목업 그대로)
```

## 담당 (features 폴더 = 백엔드 담당과 대칭)

| features | 담당 |
|---|---|
| `auth` · `user` | 이경석 |
| `store` · `product` | 박지연 |
| `order` · `review` | 이경석 |
| `admin` · `settlement` · `payment` · `chat` · `notification` · `report` | 구지훈 |
| `support` (FAQ · 정책 화면, 정적 데이터) | 공통 |

다른 사람의 `features/` 폴더는 PR 없이 수정 금지. 공유 파일(`shared/api/queryKeys.js` · `app/router.jsx`)은 도메인별 주석 구획 안에서만.

## 규칙 요약

- 응답은 `ApiResponse` 봉투 — `data.data`를 꺼내 쓴다. 에러 메시지는 `error.response.data.message`, 분기는 `code`
- 로그인 · 가입은 우리 페이지(`/api/auth/**`) — Keycloak으로 리다이렉트하지 않음. Access Token은 Zustand 메모리, Refresh Token은 httpOnly 쿠키
- 대시보드는 부분 응답(`unavailable[]`)을 카드 단위로 표시
- 보안: CSP 는 `vercel.json` 에서 강제(`Content-Security-Policy`, 11/8 Report-Only → 강제) · 판매자 HTML 은 `shared/utils/safeHtml.js`(DOMPurify)를 거쳐서만 표시 · 업로드 파일은 `shared/utils/fileType.js` 가 앞 바이트로 형식 확인(JPEG · PNG · WebP · PDF)
- 전체 규칙: [docs/CONVENTION.md](docs/CONVENTION.md)
