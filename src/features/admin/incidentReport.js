// 장애 분석 리포트 — 기간 선택 · 막대 배치 · 내려받기 파일 생성. 담당 구지훈(11/17 피드백, 계약 backend admin.md 10절)
// 내려받기는 HTML 한 파일: 1장 운영팀(요약 문장 · 시간대별 막대 · 이슈 표 · 이벤트), 2장 개발자(원인 근거 · 로그 traceId · 구간 표 · JSON).
// 브라우저로 바로 열리고 그대로 인쇄하면 PDF. 서버 값은 모두 escape 해서 넣는다(로그 · 경로는 공격자가 넣을 수 있는 값)

const HOUR = 3_600_000;

export const KIND_LABEL = { ERROR: '응답 실패', ATTACK: '공격 의심', TRAFFIC: '요청 급증' };

export const EVENT_LABEL = {
  CHAOS_KILL: '장애 주입', CHAOS_RECOVER: '복구', POD_START: '파드 시작', POD_STOP: '파드 종료', POD_RESTART: '파드 재시작',
  DEPLOY: '배포', LOADTEST_START: '부하테스트 시작', LOADTEST_END: '부하테스트 종료', CIRCUIT_OPEN: '차단기 열림',
};

export const SERVICE_LABEL = {
  'order-service': '주문', 'product-service': '상품', 'payment-service': '결제', 'store-service': '스토어', 'user-service': '회원',
  'review-service': '리뷰', 'settlement-service': '정산', 'chat-service': '채팅', 'gateway-service': '게이트웨이',
  'admin-service': '관리자', keycloak: '로그인', mysql: 'DB', redis: 'Redis',
};
export const serviceLabel = (name) => SERVICE_LABEL[name] ?? name ?? '-';

// 막대 색 — 서비스마다 고정(어느 기간을 봐도 같은 색)
const COLORS = ['#b4532a', '#2f6f8f', '#7a5c99', '#3f7d4e', '#c08a1e', '#8c3b5e', '#4a5a6a', '#9a6b3f'];
const SERVICE_ORDER = Object.keys(SERVICE_LABEL);
export const serviceColor = (name) => COLORS[Math.max(0, SERVICE_ORDER.indexOf(name)) % COLORS.length];

// 시각은 언제나 한국 시간(KST, UTC+9 고정 · 서머타임 없음) — 보는 사람 PC 시간대와 상관없이 같은 보고서가 나오게
const KST_OFFSET = 9 * HOUR;
const DAY = 24 * HOUR;
const kst = (ms) => new Date(ms + KST_OFFSET);   // getUTC* 로 읽으면 KST 값

/** 기간 버튼 — now 기준 { key, label, from, to }. 어제 퇴근 후 = 전날 18:00 ~ 오늘 09:00(아직 9시 전이면 지금까지) */
export function presets(now = new Date()) {
  const t = now.getTime();
  const today = Math.floor((t + KST_OFFSET) / DAY) * DAY - KST_OFFSET;   // 오늘 00:00 KST
  return [
    { key: '1h', label: '최근 1시간', from: t - HOUR, to: t },
    { key: 'today', label: '오늘', from: today, to: t },
    { key: 'overnight', label: '어제 퇴근 후', from: today - 6 * HOUR, to: Math.min(today + 9 * HOUR, t) },
    { key: '24h', label: '최근 24시간', from: t - DAY, to: t },
  ];
}

const pad = (n) => String(n).padStart(2, '0');
export const formatDayTime = (ms) => {
  const d = kst(ms);
  return `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};
export const formatTime = (ms) => {
  const d = kst(ms);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};
export const formatSeconds = (ms) => `${formatTime(ms)}:${pad(kst(ms).getUTCSeconds())}`;
/** datetime-local 입력값(KST) ↔ ms */
export const toLocalInput = (ms) => {
  const d = kst(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};
export const fromLocalInput = (value) => new Date(`${value}:00+09:00`).getTime();

/**
 * 시간대별 막대 배치 — 화면(SVG 요소)과 내려받기(SVG 문자열)가 같은 값을 쓴다.
 * 구간마다 서비스별 5xx 를 쌓고, 5xx 가 없는 구간에 탐색 요청이 있으면 회색 막대. 값은 건수 그대로(퍼센트 없음)
 */
export function barLayout(buckets = [], { width = 960, height = 180, pad: p = 28 } = {}) {
  const max = Math.max(1, ...buckets.map((b) => Math.max(b.serverErrors, b.suspicious)));
  const n = Math.max(1, buckets.length);
  const slot = (width - p) / n;
  const barW = Math.max(1, slot * 0.8);
  const scale = (height - p) / max;
  const rects = [];
  buckets.forEach((b, i) => {
    const x = p + i * slot;
    let y = height - p;
    Object.entries(b.byService ?? {}).forEach(([service, count]) => {
      const h = count * scale;
      y -= h;
      rects.push({ x, y, w: barW, h, color: serviceColor(service), title: `${formatDayTime(b.t)} ${serviceLabel(service)} ${count}건` });
    });
    if (b.serverErrors === 0 && b.suspicious > 0) {
      const h = b.suspicious * scale;
      rects.push({ x, y: height - p - h, w: barW, h, color: '#9aa0a6', title: `${formatDayTime(b.t)} 탐색 요청 ${b.suspicious}건` });
    }
  });
  const step = Math.max(1, Math.ceil(n / 8));
  const ticks = buckets.filter((_, i) => i % step === 0).map((b) => ({ x: p + buckets.indexOf(b) * slot, label: formatTime(b.t) }));
  return { width, height, pad: p, max, rects, ticks };
}

/** 이슈의 대표 건수 — 공격 의심은 탐색 요청, 요청 급증은 429(없으면 그 시간 전체 요청), 나머지는 5xx */
export const issueCount = (issue) => {
  if (issue.kind === 'ATTACK') return issue.suspicious;
  if (issue.kind === 'TRAFFIC') return issue.rateLimited || issue.requests || 0;
  return issue.serverErrors;
};

/** 이슈 기간 문자열 */
export const issueWindow = (issue) => `${formatDayTime(issue.startMs)} ~ ${formatTime(issue.endMs)}`;

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

function chartSvg(report) {
  const l = barLayout(report.buckets);
  const rects = l.rects.map((r) => `<rect x="${r.x.toFixed(1)}" y="${r.y.toFixed(1)}" width="${r.w.toFixed(1)}" height="${r.h.toFixed(1)}" fill="${r.color}"><title>${escapeHtml(r.title)}</title></rect>`).join('');
  const ticks = l.ticks.map((t) => `<text x="${t.x.toFixed(1)}" y="${l.height - 8}" font-size="11" fill="#666">${t.label}</text>`).join('');
  return `<svg viewBox="0 0 ${l.width} ${l.height}" width="100%" role="img" aria-label="시간대별 응답 실패 건수">`
    + `<line x1="${l.pad}" y1="${l.height - l.pad}" x2="${l.width}" y2="${l.height - l.pad}" stroke="#ccc"/>`
    + `<text x="0" y="12" font-size="11" fill="#666">${l.max}건</text>${rects}${ticks}</svg>`;
}

function legend(report) {
  const services = [...new Set(report.buckets.flatMap((b) => Object.keys(b.byService ?? {})))];
  const items = services.map((s) => `<span><i style="background:${serviceColor(s)}"></i>${escapeHtml(serviceLabel(s))}</span>`);
  if (report.buckets.some((b) => b.serverErrors === 0 && b.suspicious > 0)) items.push('<span><i style="background:#9aa0a6"></i>탐색 요청</span>');
  return items.length ? `<p class="legend">${items.join('')}</p>` : '';
}

const row = (cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;

function opsSection(report, period) {
  const issues = report.issues.length
    ? `<table><thead><tr><th>#</th><th>시간</th><th>종류</th><th>서비스</th><th>건수</th><th>원인</th><th>구분</th></tr></thead><tbody>${report.issues.map((i) => row([
      i.no, escapeHtml(issueWindow(i)), KIND_LABEL[i.kind] ?? i.kind, escapeHtml(i.services.map(serviceLabel).join(', ') || '-'),
      issueCount(i),
      escapeHtml(i.causes.map((c) => c.label).join(', ')), i.intended ? '의도한 시험' : '<b class="bad">실제 장애</b>',
    ])).join('')}</tbody></table><ol class="sentences">${report.issues.map((i) => `<li>${escapeHtml(i.sentence)}</li>`).join('')}</ol>`
    : '<p>이 기간에는 이슈가 없습니다.</p>';
  const events = report.events.length
    ? `<table><thead><tr><th>시각</th><th>종류</th><th>서비스</th><th>내용</th></tr></thead><tbody>${report.events.map((e) => row([
      formatSeconds(e.t), EVENT_LABEL[e.type] ?? e.type, escapeHtml(serviceLabel(e.service)), escapeHtml(e.detail),
    ])).join('')}</tbody></table>`
    : '<p>기록된 이벤트가 없습니다.</p>';
  const s = report.summary;
  return `<section><h2>1. 운영팀 보고</h2><p class="period">기간 ${escapeHtml(period)} · 구간 ${report.bucketSeconds / 60}분</p>
<p class="headline">${escapeHtml(s.headline)}</p>
<div class="kpis"><div><b>${s.issues}</b>이슈(의도한 시험 ${s.intendedIssues})</div><div><b>${s.serverErrors}</b>응답 실패(5xx)</div><div><b>${s.suspicious}</b>공격 의심 요청</div><div><b>${s.rateLimited}</b>요청 제한(429)</div><div><b>${s.requests}</b>전체 요청</div></div>
<h3>시간대별 건수</h3>${chartSvg(report)}${legend(report)}
<h3>이슈</h3>${issues}<h3>이벤트</h3>${events}</section>`;
}

function devSection(report) {
  const issues = report.issues.map((i) => `<h4>#${i.no} ${escapeHtml(issueWindow(i))} · ${KIND_LABEL[i.kind] ?? i.kind}</h4>
<ul>${i.causes.map((c) => `<li><code>${escapeHtml(c.code)}</code> ${escapeHtml(c.label)} — ${escapeHtml(c.detail)}</li>`).join('')}</ul>
${i.logs.length ? `<table class="logs"><thead><tr><th>시각</th><th>서비스</th><th>레벨</th><th>메시지</th><th>traceId</th></tr></thead><tbody>${i.logs.map((l) => row([
    formatSeconds(l.timestampMs), escapeHtml(serviceLabel(l.service)), escapeHtml(l.level), escapeHtml(l.title), `<code>${escapeHtml(l.traceId ?? '-')}</code>`,
  ])).join('')}</tbody></table>` : '<p class="mute">근거 로그 없음</p>'}`).join('');
  const busy = report.buckets.filter((b) => b.serverErrors || b.suspicious || b.rateLimited || b.dbErrors || b.errorLogs);
  const buckets = busy.length
    ? `<table><thead><tr><th>구간 시작</th><th>요청</th><th>5xx</th><th>서비스별 5xx</th><th>429</th><th>404</th><th>401·403</th><th>탐색</th><th>DB 오류</th><th>에러 로그</th></tr></thead><tbody>${busy.map((b) => row([
      formatDayTime(b.t), b.requests, b.serverErrors, escapeHtml(Object.entries(b.byService).map(([k, v]) => `${serviceLabel(k)} ${v}`).join(', ') || '-'),
      b.rateLimited, b.notFound, b.unauthorized, b.suspicious, b.dbErrors, b.errorLogs,
    ])).join('')}</tbody></table>`
    : '<p class="mute">이상 신호가 있는 구간이 없습니다.</p>';
  const suspicious = report.suspicious.length
    ? `<table class="logs"><tbody>${report.suspicious.map((l) => row([formatSeconds(l.timestampMs), escapeHtml(l.title)])).join('')}</tbody></table>`
    : '<p class="mute">탐색 요청 로그 없음</p>';
  return `<section class="dev"><h2>2. 개발자 상세</h2>
<h3>이슈별 원인 근거 · 로그</h3>${issues || '<p class="mute">이슈 없음</p>'}
<h3>이상 신호가 있는 구간</h3>${buckets}
<h3>탐색 요청 로그 (게이트웨이)</h3>${suspicious}
<h3>원본 데이터 (JSON)</h3><pre>${escapeHtml(JSON.stringify(report, null, 2))}</pre></section>`;
}

const STYLE = `body{font-family:'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#1f1f1f;max-width:1040px;margin:24px auto;padding:0 16px;line-height:1.5}
h1{font-size:24px;margin:0}h2{font-size:20px;border-bottom:2px solid #1f1f1f;padding-bottom:4px;margin-top:36px}h3{font-size:16px;margin-top:24px}h4{font-size:14px;margin:16px 0 4px}
.period,.mute{color:#666;font-size:13px}.headline{font-size:17px;font-weight:700;background:#f6f1e7;padding:12px 14px}
.kpis{display:flex;flex-wrap:wrap;gap:8px}.kpis div{border:1px solid #ddd;padding:8px 12px;font-size:13px;min-width:120px}.kpis b{display:block;font-size:20px}
table{border-collapse:collapse;width:100%;font-size:13px;margin:6px 0}th,td{border:1px solid #ddd;padding:4px 6px;text-align:left;vertical-align:top}th{background:#f3f3f3}
.logs td{font-family:Consolas,monospace;font-size:12px;word-break:break-all}.bad{color:#b4532a}.sentences li{margin:4px 0}
.legend span{display:inline-flex;align-items:center;gap:4px;margin-right:12px;font-size:12px}.legend i{width:10px;height:10px;display:inline-block}
pre{background:#f6f6f6;padding:12px;font-size:11px;overflow:auto;max-height:480px;white-space:pre-wrap}
@media print{.dev{break-before:page}pre{max-height:none}}`;

/** 내려받기 파일 내용 — HTML 문서 한 개 */
export function buildReportHtml(report, generatedAt = new Date()) {
  const period = `${formatDayTime(report.fromMs)} ~ ${formatDayTime(report.toMs)}`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>곳간 장애 분석 리포트 ${escapeHtml(period)}</title><style>${STYLE}</style></head><body>
<h1>곳간 장애 분석 리포트</h1><p class="period">만든 시각 ${formatDayTime(generatedAt.getTime())} · 자료 Prometheus · Loki · 장애 주입 기록 · 원인은 같은 시간대 근거로 고른 규칙 기반 추정</p>
${opsSection(report, period)}${devSection(report)}</body></html>`;
}

/** 파일 이름 — 장애리포트_1117-1050_1117-1130.html (KST) */
export function reportFileName(report) {
  const d = (ms) => formatDayTime(ms).replace('/', '').replace(' ', '-').replace(':', '');
  return `장애리포트_${d(report.fromMs)}_${d(report.toMs)}.html`;
}

/** 브라우저 내려받기 */
export function downloadReport(report) {
  const blob = new Blob([buildReportHtml(report)], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = reportFileName(report);
  a.click();
  URL.revokeObjectURL(url);
}
