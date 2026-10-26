// 신고 관리 — 담당 구지훈. 리뷰 · 회원 신고를 대상별로 묶어 처리 (블라인드 · 이용정지 · 해제 · 기각). backend docs/api/admin.md
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { PageHead, Segments, Pill, Modal, KV } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/common/DataTable';
import { SearchInput } from '@/shared/components/common/SearchInput';
import { useClientTable } from '@/shared/hooks/useClientTable';
import { useAdminReportsQuery } from '@/features/admin/hooks/useAdminReportsQuery';
import { useAdminReportQuery } from '@/features/admin/hooks/useAdminReportQuery';
import { useResolveReportMutation } from '@/features/admin/hooks/useResolveReportMutation';
import { REPORT_ACTIONS, REPORT_ACTION_LABEL, REPORT_STATUS_LABEL, SUSPEND_DURATIONS } from '@/features/admin/constants';
import { REPORT_REASON_LABEL } from '@/features/report/constants';
import { toast } from '@/shared/stores/toastStore';
import { ymdhm } from '@/shared/utils/format';

const TABS = ['처리 대기', '처리 완료', '전체'];
const TYPES = ['전체', '리뷰', '회원'];
const TYPE_LABEL = { REVIEW: '리뷰', USER: '회원' };
const STATUS_TONE = { OPEN: 'amber', RESOLVED: 'moss', DISMISSED: 'mute' };
const inTab = (t, tab) => (tab === '처리 대기' ? t.openCount > 0 : tab === '처리 완료' ? t.openCount === 0 : true);
const reasonText = (counts) => Object.entries(counts).map(([code, n]) => `${REPORT_REASON_LABEL[code] ?? code} ${n}`).join(' · ');

// 처리 버튼이 setTarget 을 써서 함수로 만들고 컴포넌트에서 useMemo (컨벤션 4-7)
function buildColumns(setTarget) {
  return [
    { id: 'type', accessorFn: (t) => TYPE_LABEL[t.targetType], header: '대상', meta: { tdClass: 'whitespace-nowrap' }, cell: ({ getValue }) => <Pill tone="line">{getValue()}</Pill> },
    {
      id: 'summary', accessorFn: (t) => t.summary ?? '', header: '내용 (신고 당시)', meta: { tdClass: 'max-w-[360px]' },
      cell: ({ row: { original: t } }) => <><p className="line-clamp-2">{t.summary || <span className="text-mute">-</span>}</p><div className="text-[11px] text-mute num">#{t.targetId}</div></>,
    },
    { id: 'reasons', accessorFn: (t) => reasonText(t.reasonCounts), header: '신고 사유', meta: { tdClass: 'text-[12.5px] text-ink-2' } },
    {
      accessorKey: 'openCount', header: '처리 대기', meta: { thClass: 'text-right', tdClass: 'text-right num', search: false },
      cell: ({ row: { original: t } }) => <><b className={t.openCount ? 'text-point' : 'text-mute'}>{t.openCount}</b><span className="text-mute"> / {t.totalCount}</span></>,
    },
    { accessorKey: 'lastReportedAt', header: '최근 신고', sortingFn: 'datetime', meta: { tdClass: 'num text-ink-2 whitespace-nowrap', search: false }, cell: ({ getValue }) => ymdhm(getValue()) },
    { id: 'last', accessorFn: (t) => (t.lastAction ? REPORT_ACTION_LABEL[t.lastAction.action] : ''), header: '마지막 조치', cell: ({ getValue }) => getValue() || <span className="text-mute">-</span> },
    {
      id: 'action', header: '', enableSorting: false, meta: { search: false },
      cell: ({ row: { original: t } }) => <button onClick={() => setTarget({ type: t.targetType, id: t.targetId })} className="btn btn-line btn-xs">{t.openCount ? '처리' : '보기'}</button>,
    },
  ];
}

export default function ReportModeration() {
  const [tab, setTab] = useState('처리 대기');
  const [type, setType] = useState('전체');
  const [target, setTarget] = useState(null);
  const { data: targets = [], isLoading, isError } = useAdminReportsQuery();
  const typed = useMemo(() => targets.filter((t) => type === '전체' || TYPE_LABEL[t.targetType] === type), [targets, type]);
  const list = useMemo(() => typed.filter((t) => inTab(t, tab)), [typed, tab]);
  const counts = useMemo(() => Object.fromEntries(TABS.map((x) => [x, typed.filter((t) => inTab(t, x)).length])), [typed]);
  const columns = useMemo(() => buildColumns(setTarget), []);
  const { table, globalFilter, setGlobalFilter } = useClientTable({ data: list, columns });

  return (
    <div>
      <PageHead title="신고 관리" desc="회원 · 리뷰 신고를 대상별로 모아 처리 · 판매자의 리뷰 검토 요청도 여기로 · 신고가 쌓여도 자동 블라인드는 하지 않음" />
      <div className="flex flex-wrap gap-3 items-center">
        <Segments items={TABS} value={tab} onChange={setTab} counts={counts} />
        <Segments items={TYPES} value={type} onChange={setType} />
        <SearchInput value={globalFilter} onChange={setGlobalFilter} placeholder="내용 · 사유" className="ml-auto" />
      </div>
      <div className="mt-3">
        <DataTable table={table} loading={isLoading} error={isError} empty="해당하는 신고가 없습니다." />
      </div>
      <ReportDetailModal target={target} onClose={() => setTarget(null)} />
    </div>
  );
}

function ReportDetailModal({ target, onClose }) {
  const { data: d } = useAdminReportQuery(target?.type, target?.id);
  return (
    <Modal open={!!target} onClose={onClose} title={target ? `${TYPE_LABEL[target.type]} 신고 #${target.id}` : ''} width={640}>
      {d ? <ReportDetailBody key={`${target.type}-${target.id}`} d={d} onDone={onClose} /> : <p className="text-mute py-6 text-center">불러오는 중…</p>}
    </Modal>
  );
}

// 대상 현재 값 · 신고 목록 · 조치 이력 · 처리 폼 — 회원 상세의 제재 이력도 같은 상세 응답
function ReportDetailBody({ d, onDone }) {
  const actions = REPORT_ACTIONS[d.targetType];
  const [action, setAction] = useState(actions[0].value);
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState(SUSPEND_DURATIONS[0].value);
  const resolve = useResolveReportMutation();
  const t = d.target;
  const days = action === 'SUSPEND' ? SUSPEND_DURATIONS.find((x) => x.value === duration)?.days : null;

  const submit = () =>
    resolve.mutate({ type: d.targetType, id: d.targetId, action, reason: reason.trim(), days }, {
      onSuccess: (r) => { toast(`${REPORT_ACTION_LABEL[action]} 처리 · 신고 ${r.closedReports}건 닫음`); onDone(); },
      onError: (err) => toast(err.response?.data?.message ?? '처리하지 못했어요. 잠시 후 다시 시도해 주세요.'),
    });

  return (
    <div className="text-[13.5px] space-y-4">
      <div className="bg-cream p-3">
        {!t && <p className="text-rust text-[12.5px]">대상 정보를 불러오지 못했어요 ({d.targetError}) — 신고 기록만 표시합니다</p>}
        {t && d.targetType === 'REVIEW' && (
          <KV rows={[['리뷰', t.content], ['별점 · 상품', t.rating ? `${t.rating}점 · 상품 #${t.productId ?? '-'}` : '-'], ['상태', t.blinded ? `블라인드 (${t.blindReason ?? ''})` : '노출 중']]} />
        )}
        {t && d.targetType === 'USER' && (
          <KV rows={[['회원', <Link to={`/admin/users/${d.targetId}`} className="hover:underline">{t.name} {t.nick && `(${t.nick})`}</Link>], ['이메일', t.email ?? '-'], ['상태', t.status === 'SUSPENDED' ? '이용정지' : '정상']]} />
        )}
      </div>

      <div>
        <div className="font-semibold mb-1">신고 {d.reports.length}건</div>
        <ul className="max-h-44 overflow-y-auto border-t border-line">
          {d.reports.map((r) => (
            <li key={r.reportId} className="py-2 border-b border-line flex gap-2 items-start">
              <Pill tone={STATUS_TONE[r.status]}>{REPORT_STATUS_LABEL[r.status]}</Pill>
              <div className="flex-1">
                <div>{REPORT_REASON_LABEL[r.reasonCode] ?? r.reasonCode}{r.detail && <span className="text-ink-2"> — {r.detail}</span>}</div>
                <div className="text-[11.5px] text-mute num">{ymdhm(r.createdAt)} · {r.reporterRole === 'SELLER' ? '판매자' : '구매자'} #{r.reporterId}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {d.actions.length > 0 && (
        <div>
          <div className="font-semibold mb-1">조치 이력</div>
          <ol className="space-y-1 text-[12.5px]">
            {d.actions.map((a) => (
              <li key={a.moderationActionId} className="text-ink-2"><span className="num text-mute">{ymdhm(a.createdAt)}</span> · <b>{REPORT_ACTION_LABEL[a.action]}</b>{a.action === 'SUSPEND' && ` (${a.suspendDays ? `${a.suspendDays}일` : '영구'})`} · {a.reason} · 신고 {a.reportCount}건</li>
            ))}
          </ol>
        </div>
      )}

      <div className="border-t border-ink pt-3 space-y-2">
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <button key={a.value} onClick={() => setAction(a.value)} className={`btn btn-sm ${action === a.value ? 'btn-ink' : 'btn-line'}`}>{a.label}</button>
          ))}
          {action === 'SUSPEND' && (
            <select value={duration} onChange={(e) => setDuration(e.target.value)} className="field field-sm h-9 w-auto">
              {SUSPEND_DURATIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
          )}
        </div>
        <textarea rows={2} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} className="field"
          placeholder={action === 'DISMISS' ? '기각 사유 (예: 정책 위반 아님)' : '처리 사유 (대상 서비스에도 기록됨)'} />
        <div className="flex justify-end">
          <button disabled={!reason.trim() || resolve.isPending} onClick={submit} className="btn btn-ink btn-sm">{REPORT_ACTION_LABEL[action]} 처리</button>
        </div>
      </div>
    </div>
  );
}
