import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { fetchIncidentReport } from '@/features/admin/api/systemApi';
import IncidentReport from '@/features/admin/components/IncidentReport';
import {
  barLayout, buildReportHtml, escapeHtml, issueCount, issueImpact, overview, presets, reportFileName, summarizeEvents,
} from '@/features/admin/incidentReport';

// 장애 분석 리포트 — 계약 backend admin.md 10절. 기간 버튼 · 운영팀 화면 · 개발자 상세 · 내려받기 HTML
const at = (hhmm) => new Date(`2026-11-17T${hhmm}:00+09:00`).getTime();

const report = () => ({
  generatedAt: '2026-11-17T11:30:00+09:00',
  fromMs: at('10:50'),
  toMs: at('11:30'),
  bucketSeconds: 60,
  summary: {
    headline: '11/17 10:50 ~ 11/17 11:30 동안 이슈 2건(실제 장애 1건, 의도한 시험 1건). 응답 실패 총 827건, 공격 의심 요청 3건.',
    issues: 2, intendedIssues: 1, requests: 4000, serverErrors: 827, suspicious: 3, rateLimited: 0,
  },
  buckets: [
    { t: at('11:07'), requests: 100, serverErrors: 431, byService: { 'product-service': 431 }, rateLimited: 0, notFound: 0, unauthorized: 0, suspicious: 0, dbErrors: 0, errorLogs: 2 },
    { t: at('11:08'), requests: 100, serverErrors: 396, byService: { 'product-service': 396 }, rateLimited: 0, notFound: 0, unauthorized: 0, suspicious: 0, dbErrors: 0, errorLogs: 0 },
    { t: at('11:24'), requests: 100, serverErrors: 0, byService: {}, rateLimited: 0, notFound: 3, unauthorized: 0, suspicious: 3, dbErrors: 0, errorLogs: 0 },
  ],
  issues: [
    {
      no: 1, kind: 'ERROR', startMs: at('11:07'), endMs: at('11:09'), services: ['product-service'], serverErrors: 827, suspicious: 0, rateLimited: 0,
      intended: true, sentence: '11/17 11:07~11:09 상품 서비스에서 응답 실패 827건. 원인: 관리자 장애 주입(의도한 시험).',
      causes: [{ code: 'CHAOS', label: '관리자 장애 주입(의도한 시험)', detail: '상품 파드 2개 강제 종료 11:06, 44초 뒤 복구' }],
      logs: [{ kind: 'LOG', timestampMs: at('11:07'), service: 'gateway-service', level: 'WARN', title: '업무 서비스 연결 실패 <route>', status: null, traceId: 'abc123' }],
    },
    {
      no: 2, kind: 'ATTACK', startMs: at('11:24'), endMs: at('11:25'), services: [], serverErrors: 0, suspicious: 3, rateLimited: 0,
      intended: false, sentence: '11/17 11:24~11:25 공격 의심 요청 3건. 원인: 공격 의심(자동 스캐너 탐색).',
      causes: [{ code: 'ATTACK', label: '공격 의심(자동 스캐너 탐색)', detail: '탐색 요청 3건 — 설정 · 비밀 파일 탐색(/.env 등) 3건' }],
      logs: [],
    },
  ],
  events: [
    { t: at('11:06'), type: 'CHAOS_KILL', service: 'product-service', detail: '관리자가 파드 2개 강제 종료(ALL)' },
    { t: at('11:07'), type: 'CHAOS_RECOVER', service: 'product-service', detail: '복구 완료(21초)' },
    { t: at('11:06'), type: 'POD_STOP', service: 'product-service', detail: 'product-service-a 종료(장애 주입)' },
    { t: at('11:06'), type: 'POD_STOP', service: 'product-service', detail: 'product-service-b 종료(장애 주입)' },
    { t: at('11:20'), type: 'POD_STOP', service: 'order-service', detail: 'order-service-c 종료(자동 축소)' },
    { t: at('11:07'), type: 'POD_START', service: 'product-service', detail: 'product-service-d 시작' },
  ],
  suspicious: [{ kind: 'LOG', timestampMs: at('11:24'), service: 'gateway-service', level: 'WARN', title: '의심 요청 type=secret-file path=/.env', status: null, traceId: null }],
});

describe('장애 분석 리포트 — 규칙', () => {
  it('기간 버튼 — 최근 1시간 · 오늘 · 어제 퇴근 후(전날 18시 ~ 오늘 9시) · 최근 24시간', () => {
    const now = new Date('2026-11-17T11:30:00+09:00');
    const byKey = Object.fromEntries(presets(now).map((p) => [p.key, p]));
    expect(byKey['1h'].from).toBe(at('10:30'));
    expect(byKey.today.from).toBe(at('00:00'));
    expect(byKey.overnight.from).toBe(new Date('2026-11-16T18:00:00+09:00').getTime());
    expect(byKey.overnight.to).toBe(at('09:00'));
    expect(byKey['24h'].to - byKey['24h'].from).toBe(24 * 3_600_000);
    // 9시 전이면 지금까지
    expect(presets(new Date('2026-11-17T07:00:00+09:00')).find((p) => p.key === 'overnight').to).toBe(at('07:00'));
  });

  it('막대 — 서비스별로 쌓고 5xx 없는 구간의 탐색 요청은 회색, 최대값은 건수', () => {
    const l = barLayout(report().buckets);
    expect(l.max).toBe(431);
    expect(l.rects).toHaveLength(3);
    expect(l.rects[0].title).toBe('11/17 11:07 상품 431건');
    expect(l.rects[2].color).toBe('#9aa0a6');
  });

  it('대표 건수 · 파일 이름 · escape', () => {
    const [error, attack] = report().issues;
    expect(issueCount(error)).toBe(827);
    expect(issueCount(attack)).toBe(3);
    expect(issueCount({ kind: 'TRAFFIC', rateLimited: 0, requests: 5200 })).toBe(5200);
    expect(issueCount({ kind: 'TRAFFIC', rateLimited: 15, requests: 5200 })).toBe(15);
    expect(reportFileName(report())).toBe('장애리포트_1117-1050_1117-1130.html');
    expect(escapeHtml('<a href="x">&\'')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  });

  it('한눈에 보기, 영향 한 줄, 이벤트 요약표 — 파드 이벤트는 종류별 한 줄로 묶는다', () => {
    expect(overview(report()).statusText).toBe('실제 장애 1건');
    expect(issueImpact(report().issues[0])).toBe('상품, 5xx 827건');
    expect(issueImpact(report().issues[1])).toBe('탐색 요청 3건');
    expect(summarizeEvents(report().events)).toEqual([
      { label: '장애 주입', count: 1, detail: '상품 / 복구 평균 21초, 최장 21초' },
      { label: '파드 종료', count: 3, detail: '장애 주입 2, 자동 축소', alert: false },
      { label: '파드 시작', count: 1, detail: '상품' },
    ]);
  });

  it('내려받기 HTML — 섹션 5개(한눈에 보기, 이슈, 이벤트 요약, 시간대별, 개발자 상세), 로그는 escape', () => {
    const html = buildReportHtml(report(), new Date('2026-11-17T11:31:00+09:00'));
    ['1. 한눈에 보기', '2. 이슈', '3. 운영 이벤트 요약', '4. 시간대별 건수', '5. 개발자 상세'].forEach((h) => expect(html).toContain(`<h2>${h}</h2>`));
    expect(html).toContain('실제 장애 1건');
    expect(html).toContain('<td>파드 종료</td><td>3</td><td>장애 주입 2, 자동 축소</td>');
    expect(html).toContain('<svg');
    expect(html).toContain('의도한 시험');
    expect(html).toContain('<b class="bad">실제 장애</b>');
    expect(html).toContain('<code>abc123</code>');
    expect(html).toContain('업무 서비스 연결 실패 &lt;route&gt;');
    expect(html).not.toContain('업무 서비스 연결 실패 <route>');
    expect(html).toContain('&quot;bucketSeconds&quot;: 60');
  });
});

describe('장애 분석 리포트 — 화면', () => {
  let queryClient;
  beforeEach(() => {
    vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: report() } });
  });
  afterEach(() => { cleanup(); queryClient?.clear(); vi.restoreAllMocks(); });

  const renderPage = () => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<MemoryRouter><QueryClientProvider client={queryClient}><IncidentReport /></QueryClientProvider></MemoryRouter>);
  };

  it('API — from · to 를 ISO 로 보낸다', async () => {
    await fetchIncidentReport(at('10:50'), at('11:30'));
    expect(axiosInstance.get).toHaveBeenCalledWith('/api/admin/system/report', {
      params: { from: '2026-11-17T01:50:00.000Z', to: '2026-11-17T02:30:00.000Z' },
    });
  });

  it('요약 문장 · 이슈 표(실제 장애 / 의도한 시험) · 이벤트를 보여 주고, 기간 버튼을 누르면 다시 조회한다', async () => {
    renderPage();
    expect((await screen.findByLabelText('상태')).textContent).toBe('실제 장애 1건');
    const table = screen.getByRole('table', { name: '이슈 목록' });
    expect(within(table).getByText('의도한 시험')).toBeTruthy();
    expect(within(table).getByText('실제 장애')).toBeTruthy();
    expect(within(table).getByText('상품, 5xx 827건')).toBeTruthy();
    const events = screen.getByRole('table', { name: '운영 이벤트 요약' });
    expect(within(events).getByText('장애 주입 2, 자동 축소')).toBeTruthy();
    expect(screen.getByText(/traceId abc123/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '어제 퇴근 후' }));
    await waitFor(() => expect(axiosInstance.get).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('button', { name: '어제 퇴근 후' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('보고서 내려받기 — 리포트를 받기 전엔 막혀 있고, 받으면 HTML 파일 하나를 만든다', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderPage();
    const button = screen.getByRole('button', { name: /보고서 내려받기/ });
    expect(button.disabled).toBe(true);
    await screen.findByLabelText('상태');
    fireEvent.click(button);

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL.mock.calls[0][0].type).toBe('text/html;charset=utf-8');
    expect(click).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
  });
});
