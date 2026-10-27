// 임시 점검 화면 — 팀원 안내 (담당 구지훈). 화면 연결 전 기능을 여기서 점검하는 방법 · 점검 칸을 추가하는 방법
export default function QaGuide() {
  return (
    <section className="panel p-5 space-y-3 text-[13px] leading-relaxed">
      <div className="panel-title">이 화면 쓰는 법 (팀원 공용)</div>
      <ol className="list-decimal pl-5 space-y-1">
        <li>필요한 역할 계정으로 로그인한 뒤 <code>/qa</code> 로 들어옵니다 — 칸마다 보이는 역할이 달라요(구매자 · 판매자 · 관리자).</li>
        <li>화면이 아직 목업이면 아래 <b>⑤ API 직접 호출</b>에서 예시를 누르고 보내기 — 실제 응답 · 오류 코드를 바로 봅니다.</li>
        <li>맨 위 CSP 위반 칸이 0 이 아니면 그 문구를 구지훈에게 알려 주세요 (보안 헤더 허용 목록 점검 중).</li>
      </ol>
      <div className="font-semibold pt-2">내 기능 점검 칸 추가하기 — 화면 연결이 늦어지는 기능이면</div>
      <ol className="list-decimal pl-5 space-y-1">
        <li>예시 버튼만 필요하면: <code>features/qa/components/ApiConsole.jsx</code> 의 <code>PRESETS</code> 에 한 줄 추가<br />
          <code className="text-[12px] break-all">{"{ owner: '박지연', label: '재고 수정', role: '판매자', method: 'PATCH', path: '/api/seller/products/101/stocks', body: { … } }"}</code></li>
        <li>버튼 · 입력 흐름이 필요하면: <code>features/qa/components/</code> 에 <code>XxxCheck.jsx</code>(<code>QaChecks.jsx</code> 의 <code>PaymentCheck</code> 모양)를 만들고,
          훅은 실제 화면이 쓸 것(<code>features/내도메인/hooks</code>)을 그대로 가져다 씁니다 — 화면 연결 때 다시 만들 필요 없게.</li>
        <li><code>QaChecks.jsx</code> 에 역할 조건과 함께 한 줄 — 예: <code>{"{has(user, 'SELLER') && <StockCheck />}"}</code></li>
        <li>PR 본문에 "/qa ○번에서 점검" 이라고 적어 리뷰어가 같은 방법으로 확인하게 합니다.</li>
      </ol>
      <p className="text-[12px] text-mute">이 화면은 시연 전에 지웁니다 — 점검용 코드는 여기에만 두고, 실제 화면에는 넣지 마세요.</p>
    </section>
  );
}
