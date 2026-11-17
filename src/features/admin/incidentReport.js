// 장애 분석 리포트: 기간 선택, 요약 계산, 막대 배치, 내려받기 파일 생성. 담당 구지훈(11/17 피드백, 계약 backend admin.md 10절)
// 화면과 내려받기는 같은 구성: 1 한눈에 보기, 2 이슈(요약표 + 이슈별 개조식), 3 운영 이벤트 요약표, 4 시간대별 건수, 5 개발자 상세.
// 파드 시작, 종료 같은 원본 이벤트는 요약표로 묶고 하나하나는 개발자 상세에만 둔다.
// 내려받기는 HTML 한 파일(브라우저로 열고 인쇄하면 PDF). 서버 값은 모두 escape(로그와 경로는 공격자가 넣을 수 있는 값)

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

// 시각은 언제나 한국 시간(KST, UTC+9 고정, 서머타임 없음) — 보는 사람 PC 시간대와 상관없이 같은 보고서가 나오게
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

/** 이슈 길이(분) */
export const issueMinutes = (issue) => Math.max(1, Math.round((issue.endMs - issue.startMs) / 60_000));

/** 이슈 영향 한 줄: "상품, 5xx 913건" */
export function issueImpact(issue) {
  const where = issue.services.map(serviceLabel).join(', ');
  const traffic = issue.rateLimited ? `429 ${issue.rateLimited}건` : `요청 ${issue.requests ?? 0}건`;
  const what = { ATTACK: `탐색 요청 ${issue.suspicious}건`, TRAFFIC: traffic }[issue.kind] ?? `5xx ${issue.serverErrors}건`;
  return where ? `${where}, ${what}` : what;
}

/**
 * 이슈 구분 — 외부 탐색(자동 스캐너, 공격 의심), 의도한 시험(장애 주입, 부하테스트), 실제 장애(그 밖).
 * 외부 탐색은 대부분 인증 단계에서 막혀 서비스 영향이 없어 실제 장애와 따로 센다
 */
export const ISSUE_CLASS = {
  attack: { short: '외부 탐색', long: '외부 탐색(인터넷 자동 스캐너), 서비스 영향은 응답 실패 건수로 확인' },
  intended: { short: '의도한 시험', long: '의도한 시험(장애 주입 또는 부하테스트)' },
  real: { short: '실제 장애', long: '실제 장애, 확인 필요' },
};
export const issueClass = (issue) => {
  if (issue.kind === 'ATTACK') return 'attack';
  return issue.intended ? 'intended' : 'real';
};

/** 한눈에 보기 — 상태 배지와 숫자 카드. 배지는 서비스 장애만 세고 외부 탐색은 따로 덧붙인다 */
export function overview(report) {
  const s = report.summary;
  const real = report.issues.filter((i) => issueClass(i) === 'real').length;
  const attacks = report.issues.filter((i) => issueClass(i) === 'attack').length;
  const base = real > 0 ? `실제 장애 ${real}건` : '실제 장애 없음';
  return {
    status: real > 0 ? 'bad' : 'ok',
    statusText: attacks > 0 ? `${base}, 외부 탐색 ${attacks}건` : base,
    cards: [
      { label: '이슈', value: s.issues, sub: `의도한 시험 ${s.intendedIssues}` },
      { label: '응답 실패(5xx)', value: s.serverErrors },
      { label: '공격 의심', value: s.suspicious },
      { label: '요청 제한(429)', value: s.rateLimited },
      { label: '전체 요청', value: s.requests },
    ],
  };
}

const tally = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);
const joinTally = (map) => [...map].map(([k, n]) => (n > 1 ? `${k} ${n}` : k)).join(', ');
const servicesOf = (list) => {
  const m = new Map();
  list.forEach((e) => tally(m, serviceLabel(e.service)));
  return joinTally(m);
};
const numbersIn = (list, re) => list.map((e) => Number(re.exec(e.detail)?.[1])).filter(Boolean);

/**
 * 운영 이벤트 요약표 — 원본 이벤트(파드 시작, 종료 하나하나)를 종류별 한 줄로 묶는다.
 * [{ label, count, detail, alert }] 0건인 종류는 뺀다. alert = 원인 미상 종료, 재시작, 차단기처럼 확인이 필요한 줄
 */
export function summarizeEvents(events = []) {
  const by = (type) => events.filter((e) => e.type === type);
  const rows = [];
  const chaos = by('CHAOS_KILL');
  if (chaos.length) {
    const secs = numbersIn(by('CHAOS_RECOVER'), /(\d+)초/);
    const recovery = secs.length ? ` / 복구 평균 ${Math.round(secs.reduce((a, b) => a + b, 0) / secs.length)}초, 최장 ${Math.max(...secs)}초` : '';
    rows.push({ label: '장애 주입', count: chaos.length, detail: servicesOf(chaos) + recovery });
  }
  const loads = by('LOADTEST_START');
  if (loads.length) {
    const peaks = numbersIn(by('LOADTEST_END'), /최대 (\d+)명/);
    rows.push({ label: '부하테스트', count: loads.length, detail: peaks.length ? `최대 ${Math.max(...peaks)}명` : '' });
  }
  const deploys = by('DEPLOY');
  if (deploys.length) rows.push({ label: '배포', count: deploys.length, detail: servicesOf(deploys) });
  const stops = by('POD_STOP');
  if (stops.length) {
    const reasons = new Map();
    stops.forEach((e) => tally(reasons, /\(([^)]+)\)$/.exec(e.detail)?.[1] ?? '원인 미상'));
    rows.push({ label: '파드 종료', count: stops.length, detail: joinTally(reasons), alert: reasons.has('원인 미상') });
  }
  const starts = by('POD_START');
  if (starts.length) rows.push({ label: '파드 시작', count: starts.length, detail: servicesOf(starts) });
  const restarts = by('POD_RESTART');
  if (restarts.length) rows.push({ label: '파드 재시작', count: restarts.length, detail: servicesOf(restarts), alert: true });
  const circuits = by('CIRCUIT_OPEN');
  if (circuits.length) rows.push({ label: '차단기 열림', count: circuits.length, detail: circuits.map((e) => e.detail).join(', '), alert: true });
  return rows;
}

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
const table = (head, rows) => `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
const mute = (text) => `<p class="mute">${text}</p>`;

function summarySection(report, period) {
  const o = overview(report);
  const cards = o.cards.map((c) => `<div><span>${c.label}</span><b>${c.value.toLocaleString('ko-KR')}</b>${c.sub ? `<em>${c.sub}</em>` : ''}</div>`).join('');
  return `<section><h2>1. 한눈에 보기</h2>
<p class="meta">기간 ${escapeHtml(period)} / 구간 ${report.bucketSeconds / 60}분</p>
<p class="status ${o.status}">${o.statusText}</p><div class="kpis">${cards}</div></section>`;
}

function issueCard(i) {
  const causes = i.causes.map((c, k) => `<li><b>${k === 0 ? '원인' : '관련'}</b>${escapeHtml(c.label)}: ${escapeHtml(c.detail)}</li>`).join('');
  return `<div class="issue${issueClass(i) === 'real' ? ' real' : ''}"><h4>#${i.no} ${KIND_LABEL[i.kind] ?? i.kind}<small>${escapeHtml(issueWindow(i))}, ${issueMinutes(i)}분</small></h4>
<ul><li><b>영향</b>${escapeHtml(issueImpact(i))}</li>${causes}<li><b>구분</b>${ISSUE_CLASS[issueClass(i)].long}</li></ul></div>`;
}

function issueSection(report) {
  if (report.issues.length === 0) return `<section><h2>2. 이슈</h2>${mute('이 기간에는 이슈가 없습니다.')}</section>`;
  const summary = table(['#', '시간', '길이', '종류', '영향', '주 원인', '구분'], report.issues.map((i) => row([
    i.no, escapeHtml(issueWindow(i)), `${issueMinutes(i)}분`, KIND_LABEL[i.kind] ?? i.kind, escapeHtml(issueImpact(i)),
    escapeHtml(i.causes[0]?.label ?? '-'), issueClass(i) === 'real' ? '<b class="bad">실제 장애</b>' : ISSUE_CLASS[issueClass(i)].short,
  ])));
  return `<section><h2>2. 이슈</h2>${summary}${report.issues.map(issueCard).join('')}</section>`;
}

function eventSection(report) {
  const rows = summarizeEvents(report.events);
  if (rows.length === 0) return `<section><h2>3. 운영 이벤트 요약</h2>${mute('기록된 이벤트가 없습니다.')}</section>`;
  const body = rows.map((r) => row([r.alert ? `<b class="bad">${r.label}</b>` : r.label, r.count, escapeHtml(r.detail)]));
  return `<section><h2>3. 운영 이벤트 요약</h2>${table(['종류', '건수', '내용'], body)}${mute('이벤트 하나하나는 5. 개발자 상세에 있습니다.')}</section>`;
}

function chartSection(report) {
  return `<section><h2>4. 시간대별 건수</h2>${chartSvg(report)}${legend(report)}</section>`;
}

function devSection(report) {
  const logs = report.issues.map((i) => `<h4>#${i.no} ${escapeHtml(issueWindow(i))}</h4>${i.logs.length
    ? table(['시각', '서비스', '레벨', '메시지', 'traceId'], i.logs.map((l) => row([
      formatSeconds(l.timestampMs), escapeHtml(serviceLabel(l.service)), escapeHtml(l.level), escapeHtml(l.title), `<code>${escapeHtml(l.traceId ?? '-')}</code>`,
    ])))
    : mute('근거 로그 없음')}`).join('');
  const busy = report.buckets.filter((b) => b.serverErrors || b.suspicious || b.rateLimited || b.dbErrors || b.errorLogs);
  const buckets = busy.length
    ? table(['구간 시작', '요청', '5xx', '서비스별 5xx', '429', '404', '401/403', '탐색', 'DB 오류', '에러 로그'], busy.map((b) => row([
      formatDayTime(b.t), b.requests, b.serverErrors, escapeHtml(Object.entries(b.byService).map(([k, v]) => `${serviceLabel(k)} ${v}`).join(', ') || '-'),
      b.rateLimited, b.notFound, b.unauthorized, b.suspicious, b.dbErrors, b.errorLogs,
    ])))
    : mute('이상 신호가 있는 구간이 없습니다.');
  const suspicious = report.suspicious.length
    ? table(['시각', '내용'], report.suspicious.map((l) => row([formatSeconds(l.timestampMs), escapeHtml(l.title)])))
    : mute('탐색 요청 로그 없음');
  const events = report.events.length
    ? table(['시각', '종류', '서비스', '내용'], report.events.map((e) => row([
      formatSeconds(e.t), EVENT_LABEL[e.type] ?? e.type, escapeHtml(serviceLabel(e.service)), escapeHtml(e.detail),
    ])))
    : mute('이벤트 없음');
  return `<section class="dev"><h2>5. 개발자 상세</h2>
<h3>이슈별 근거 로그</h3>${logs || mute('이슈 없음')}
<h3>이상 신호가 있는 구간</h3>${buckets}
<h3>탐색 요청 로그 (게이트웨이)</h3>${suspicious}
<h3>전체 이벤트</h3>${events}
<h3>원본 데이터 (JSON)</h3><pre>${escapeHtml(JSON.stringify(report, null, 2))}</pre></section>`;
}

const STYLE = `body{font-family:'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#1f1f1f;max-width:1040px;margin:24px auto;padding:0 16px;line-height:1.5}
h1{font-size:24px;margin:0}h2{font-size:19px;border-bottom:2px solid #1f1f1f;padding-bottom:4px;margin-top:32px}h3{font-size:15px;margin-top:20px}h4{font-size:14px;margin:0 0 6px}
.meta,.mute{color:#666;font-size:13px}small{color:#666;font-weight:400;margin-left:8px}
.status{display:inline-block;font-weight:700;padding:6px 12px;margin:4px 0 10px}.status.ok{background:#e7f2ea;color:#2f6b3f}.status.bad{background:#f8e3dc;color:#b4532a}
.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.kpis div{border:1px solid #ddd;padding:8px 12px}.kpis span{display:block;font-size:12px;color:#666}.kpis b{display:block;font-size:22px}.kpis em{font-style:normal;font-size:12px;color:#666}
table{border-collapse:collapse;width:100%;font-size:13px;margin:6px 0}th,td{border:1px solid #ddd;padding:5px 7px;text-align:left;vertical-align:top}th{background:#f3f3f3}
.issue{border:1px solid #ddd;border-left:4px solid #9aa0a6;padding:8px 12px;margin:8px 0}.issue.real{border-left-color:#b4532a}.issue ul{margin:0;padding-left:18px}.issue li{margin:2px 0;font-size:13px}.issue li b{display:inline-block;min-width:40px;color:#444}
.dev td{font-size:12px;word-break:break-all}.bad{color:#b4532a}code{font-family:Consolas,monospace;font-size:12px}
.legend span{display:inline-flex;align-items:center;gap:4px;margin-right:12px;font-size:12px}.legend i{width:10px;height:10px;display:inline-block}
pre{background:#f6f6f6;padding:12px;font-size:11px;overflow:auto;max-height:480px;white-space:pre-wrap}
@media print{.dev{break-before:page}pre{max-height:none}}`;

/** 내려받기 파일 내용 — HTML 문서 한 개 */
export function buildReportHtml(report, generatedAt = new Date()) {
  const period = `${formatDayTime(report.fromMs)} ~ ${formatDayTime(report.toMs)}`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>곳간 장애 분석 리포트 ${escapeHtml(period)}</title><style>${STYLE}</style></head><body>
<h1>곳간 장애 분석 리포트</h1><p class="meta">만든 시각 ${formatDayTime(generatedAt.getTime())} / 자료: Prometheus, Loki, 장애 주입 기록 / 원인은 같은 시간대 근거로 고른 규칙 기반 추정</p>
${summarySection(report, period)}${issueSection(report)}${eventSection(report)}${chartSection(report)}${devSection(report)}</body></html>`;
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
