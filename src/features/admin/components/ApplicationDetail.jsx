import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { FileText, ExternalLink } from 'lucide-react';
import { PageHead, StatusPill, Modal, KV, Checkbox } from '@/shared/components/ui';
import { useApplicationQuery } from '@/features/admin/hooks/useApplicationQuery';
import { useAdminCategoriesQuery } from '@/features/admin/hooks/useAdminCategoriesQuery';
import { useDecideApplicationMutation } from '@/features/admin/hooks/useDecideApplicationMutation';
import { DOC_TYPES, APPLICATION_STATUS_LABEL } from '@/features/admin/constants';
import { PAYMENT_FEE } from '@/features/settlement/constants';
import { toast } from '@/shared/stores/toastStore';
import { won, ymdhm, pct, cx } from '@/shared/utils/format';
import { safeHtml } from '@/shared/utils/safeHtml';

const CHECKLIST = [['biz', '사업자 상태 정상 (국세청 조회)'], ['ecom', '통신판매업 신고 확인'], ['dup', '기존 스토어 중복 입점 없음'], ['cat', '카테고리 · 상품 적합']];
const REJECT_REASONS = ['사업자 정보 확인 불가', '판매 금지 품목 포함', '정품/인증 증빙 불가', '기존 스토어 중복 입점', '기타'];
const MAX_REASON = 255; // store 사유 컬럼 길이 — 넘으면 400

// 입점 심사 상세 — 담당 구지훈. 신청서 · 서류(presigned 10분) · 처리 이력 · 같은 사업자번호 신청/스토어는 상세 API 한 번으로
export default function ApplicationDetail() {
  const { id } = useParams();
  const { data: a, isLoading, isError } = useApplicationQuery(id);
  if (isLoading) return <p className="text-mute py-10 text-center">불러오는 중…</p>;
  if (isError || !a) return <p className="text-mute py-10 text-center">신청을 찾을 수 없어요</p>;
  return <DetailBody key={a.id} a={a} />; // key: 다른 신청으로 이동하면 체크리스트 상태 초기화
}

function DetailBody({ a }) {
  const nav = useNavigate();
  const { data: categories = [] } = useAdminCategoriesQuery();
  const decide = useDecideApplicationMutation();
  const [modal, setModal] = useState(null);
  const current = a.documents.filter((d) => d.current);
  const has = (type) => current.some((d) => d.docType === type);
  const dupCount = a.sameBizRegNo.applications.length + a.sameBizRegNo.stores.length;
  // 체크리스트는 화면에서만 — 서버는 받지도 검사하지도 않음 (STR-10)
  const [checks, setChecks] = useState({ biz: has('BUSINESS_REG'), ecom: has('ECOMMERCE_REG'), dup: dupCount === 0, cat: true });
  const [requestedDocs, setRequestedDocs] = useState([]);
  const [message, setMessage] = useState('');
  const [rejectPreset, setRejectPreset] = useState(REJECT_REASONS[0]);
  const [rejectDetail, setRejectDetail] = useState('');
  const c = categories.find((x) => x.categoryId === a.categoryId);
  const commission = c?.commission == null ? '–' : pct(c.commission);
  const allChecked = Object.values(checks).every(Boolean);
  const rejectReason = rejectDetail.trim() ? `${rejectPreset} — ${rejectDetail.trim()}` : rejectPreset;

  const submit = (action, body, msg) =>
    decide.mutate(
      { id: a.id, action, body },
      {
        onSuccess: () => { setModal(null); toast(msg); void nav('/admin/applications'); },
        onError: (err) => toast(err.response?.data?.message ?? '처리하지 못했어요. 잠시 후 다시 시도해 주세요.'),
      },
    );
  const toggleDoc = (value, on) => setRequestedDocs((prev) => (on ? [...prev, value] : prev.filter((v) => v !== value)));

  return (
    <div>
      <PageHead crumbs="판매자 > 입점 심사" title={<>{a.storeName} <span className="text-[14px] font-normal text-mute num ml-1">{a.no}</span></>} desc={`신청일시 ${ymdhm(a.applied)}`}
        right={<StatusPill s={a.status} />} />
      {a.note && ['보완요청', '반려'].includes(a.status) && <div className={cx('mb-4 px-4 py-3 text-[13px]', a.status === '반려' ? 'bg-rust-soft text-rust' : 'bg-amber-soft text-amber')}>{a.note}</div>}
      <div className="grid xl:grid-cols-[1fr_360px] gap-4">
        <div className="space-y-4">
          <div className="panel">
            <div className="panel-head"><span className="panel-title">신청 정보</span></div>
            <div className="p-5"><KV cols={2} rows={[
              ['스토어명', a.storeName], ['대표자', a.owner], ['상호', a.companyName], ['사업자 구분', a.bizType],
              ['사업자번호', <span className="num">{a.bizNo}</span>], ['통신판매업', <span className="num">{a.ecomNo}</span>],
              ['카테고리', `${a.catName} (수수료 ${commission})`], ['연락처', a.phone], ['이메일', a.email], ['사업장 주소', a.address],
              ['월 예상매출', a.expected], ['운영 채널', a.channel],
              ['정산 계좌', a.account ? `${a.account.bank} ${a.account.number} (${a.account.holder})` : '-'],
            ]} /></div>
          </div>
          <div className="panel">
            <div className="panel-head"><span className="panel-title">스토어 소개 · 판매 예정 상품</span></div>
            <div className="p-5">
              <div className="text-[14px] text-ink-2 leading-relaxed [&_p]:mb-2 [&_img]:max-w-full [&_a]:underline" dangerouslySetInnerHTML={safeHtml(a.intro)} />
              <ul className="mt-4 border-t border-line">{a.products.map((p) => <li key={p.name} className="py-2.5 border-b border-line text-[13px] flex justify-between">{p.name}<span className="text-mute">{p.subCategory} · {won(p.price)}</span></li>)}</ul>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head"><span className="panel-title">제출 서류</span><span className="text-[11.5px] text-mute">링크는 10분 동안 열려요 — 만료되면 새로고침</span></div>
            <div className="p-5 grid sm:grid-cols-2 gap-2">
              {DOC_TYPES.map(({ value, label }) => {
                const docs = a.documents.filter((d) => d.docType === value);
                if (!docs.length) {
                  return (
                    <div key={value} className="flex items-center gap-3 border border-dashed border-rust/50 bg-rust-soft/40 p-3">
                      <FileText size={18} className="text-rust" />
                      <div className="flex-1 text-[13px]"><div className="font-semibold">{label}</div><div className="text-[11.5px] text-mute">미제출</div></div>
                    </div>
                  );
                }
                return docs.map((d) => (
                  <div key={d.documentId} className={cx('flex items-center gap-3 border border-line p-3', !d.current && 'opacity-60')}>
                    <FileText size={18} className="text-ink" />
                    <div className="flex-1 min-w-0 text-[13px]"><div className="font-semibold">{label}{!d.current && ' (이전 제출본)'}</div><div className="text-[11.5px] text-mute truncate">{d.originalName}</div></div>
                    {/* url 은 10분짜리 서명 주소 — 만들지 못하면 null(store #158). 만료되면 새로고침해 다시 받는다 */}
                    {d.url
                      ? <a href={d.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-xs" title="주소는 10분 뒤 만료돼요 — 열리지 않으면 새로고침"><ExternalLink size={13} /> 열기</a>
                      : <span className="text-[11.5px] text-mute shrink-0">파일을 불러오지 못했어요 · 새로고침</span>}
                  </div>
                ));
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4 xl:sticky xl:top-20 self-start">
          <div className="panel">
            <div className="panel-head"><span className="panel-title">심사 체크리스트</span></div>
            <div className="p-5 space-y-2.5 text-[13px]">
              {CHECKLIST.map(([k, l]) => (
                <Checkbox key={k} checked={checks[k]} onChange={(v) => setChecks({ ...checks, [k]: v })} label={l} />
              ))}
              <div className="mt-2 border-t border-line pt-2.5 text-[12px] text-ink-2">
                <div className="font-semibold">같은 사업자번호</div>
                {dupCount === 0 && <div className="text-mute">다른 신청 · 스토어 없음</div>}
                {a.sameBizRegNo.applications.map((x) => <div key={`a${x.applicationId}`} className="num">{x.applicationNo} · {x.storeName} · {APPLICATION_STATUS_LABEL[x.status] ?? x.status}</div>)}
                {a.sameBizRegNo.stores.map((x) => <div key={`s${x.storeId}`}>스토어 {x.storeName} · {x.status}</div>)}
              </div>
            </div>
          </div>
          {['심사대기', '보완요청'].includes(a.status) && (
            <div className="panel p-5 space-y-2">
              <button onClick={() => setModal('approve')} disabled={!allChecked} className="btn btn-ink w-full">승인</button>
              {a.status === '심사대기' && <button onClick={() => setModal('supplement')} className="btn btn-line w-full">보완 요청</button>}
              <button onClick={() => setModal('reject')} className="btn btn-line w-full text-rust">반려</button>
              {!allChecked && <p className="text-[11.5px] text-mute text-center">체크리스트를 모두 확인해야 승인할 수 있어요</p>}
            </div>
          )}
          <div className="panel">
            <div className="panel-head"><span className="panel-title">처리 이력</span></div>
            <ol className="p-5 space-y-3 text-[13px]">
              {a.history.map((h) => (
                <li key={`${h.at?.getTime()}-${h.to}`} className="relative pl-4 border-l-2 border-line">
                  <div className="flex items-center gap-1.5">
                    {h.from && <><StatusPill s={h.from} /><span className="text-mute">→</span></>}
                    <StatusPill s={h.to} />
                  </div>
                  {h.reason && <div className="mt-1 text-ink-2">{h.reason}</div>}
                  <div className="text-[11.5px] text-mute num">{ymdhm(h.at)} · {h.by}</div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <Modal open={modal === 'approve'} onClose={() => setModal(null)} title="입점 승인" width={480}
        footer={<><button className="btn btn-line btn-sm" onClick={() => setModal(null)}>취소</button><button className="btn btn-ink btn-sm" disabled={decide.isPending} onClick={() => submit('approve', undefined, `${a.storeName} 입점 승인 · 승인 안내 메일 발송`)}>승인 확정</button></>}>
        <div className="space-y-4 text-[14px]">
          <KV rows={[['스토어', a.storeName], ['스토어 URL', <span className="num">gotgan.kr/store/{a.slug}</span>], ['판매수수료', `${commission} (카테고리 기본)`], ['결제수수료', pct(PAYMENT_FEE, 1)], ['판매자 등급', '새싹 (시작 등급)']]} />
          <p className="text-[12px] text-mute">승인 시: ① 스토어 생성(상태: 운영중) ② 판매자 권한 부여(신청자의 다음 로그인부터) ③ 승인 안내 메일 발송</p>
        </div>
      </Modal>
      <Modal open={modal === 'supplement'} onClose={() => setModal(null)} title="보완 요청" width={480}
        footer={<><button className="btn btn-line btn-sm" onClick={() => setModal(null)}>취소</button><button className="btn btn-ink btn-sm" disabled={decide.isPending || !message.trim() || message.trim().length > MAX_REASON} onClick={() => submit('supplement', { message: message.trim(), requestedDocs }, '보완 요청을 보냈어요 (7일 내 미보완 시 자동 반려)')}>요청 보내기</button></>}>
        <div className="space-y-2 text-[14px]">{DOC_TYPES.map((d) => <Checkbox key={d.value} checked={requestedDocs.includes(d.value)} onChange={(on) => toggleDoc(d.value, on)} label={`${d.label} 재제출`} />)}</div>
        <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} className="field mt-4" placeholder="판매자에게 전달할 메시지 (필수 · 서류가 아닌 내용 보완이면 서류 선택 없이)" />
      </Modal>
      <Modal open={modal === 'reject'} onClose={() => setModal(null)} title="입점 반려" width={480}
        footer={<><button className="btn btn-line btn-sm" onClick={() => setModal(null)}>취소</button><button className="btn btn-sm bg-rust text-white border-rust" disabled={decide.isPending || rejectReason.length > MAX_REASON} onClick={() => submit('reject', { reason: rejectReason }, '반려 처리 · 사유가 신청자에게 발송되었어요')}>반려 확정</button></>}>
        <label className="label">반려 사유</label>
        <select value={rejectPreset} onChange={(e) => setRejectPreset(e.target.value)} className="field mb-3">{REJECT_REASONS.map((r) => <option key={r}>{r}</option>)}</select>
        <textarea rows={3} value={rejectDetail} onChange={(e) => setRejectDetail(e.target.value)} className="field" placeholder="상세 사유 (신청자에게 전달됨)" />
        <p className="text-[12px] text-mute mt-2">반려 후 30일 이내 재신청이 제한됩니다.</p>
      </Modal>
    </div>
  );
}
