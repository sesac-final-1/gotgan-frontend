import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { FileText, ExternalLink } from 'lucide-react';
import { PageHead, StatusPill, Modal, KV, Checkbox } from '@/shared/components/ui';
import { useApplicationsQuery } from '@/features/admin/hooks/useApplicationsQuery';
import { useApplicationHistoryQuery } from '@/features/admin/hooks/useApplicationHistoryQuery';
import { useAdminCategoriesQuery } from '@/features/admin/hooks/useAdminCategoriesQuery';
import { useDecideApplicationMutation } from '@/features/admin/hooks/useDecideApplicationMutation';
import { PAYMENT_FEE } from '@/features/settlement/constants';
import { toast } from '@/shared/stores/toastStore';
import { ymdhm, pct, cx } from '@/shared/utils/format';

const DOCS = [['biz', '사업자등록증'], ['ecom', '통신판매업 신고증'], ['bank', '통장 사본'], ['sample', '대표 상품 사진']];
const CHECKLIST = [['biz', '사업자 상태 정상 (국세청 조회)'], ['ecom', '통신판매업 신고 확인'], ['dup', '기존 스토어 중복 입점 없음'], ['cat', '카테고리 · 상품 적합'], ['kc', '카테고리 필수 인증서 (KC 등)']];

// 입점 심사 상세 — 담당 구지훈. 화면 · 문구는 목업 그대로, 처리는 mutation · 오른쪽에 상태 변경 타임라인(10/15 추가)
export default function ApplicationDetail() {
  const { id } = useParams();
  const { data: apps = [], isLoading } = useApplicationsQuery();
  const a = apps.find((x) => x.id === id);
  if (isLoading) return <p className="text-mute py-10 text-center">불러오는 중…</p>;
  if (!a) return <p className="text-mute py-10 text-center">신청을 찾을 수 없어요</p>;
  return <DetailBody key={a.id} a={a} />; // key: 다른 신청으로 이동하면 체크리스트 상태 초기화
}

function DetailBody({ a }) {
  const nav = useNavigate();
  const { data: categories = [] } = useAdminCategoriesQuery();
  const { data: history = [] } = useApplicationHistoryQuery();
  const decide = useDecideApplicationMutation();
  const [modal, setModal] = useState(null);
  const [promo, setPromo] = useState(true);
  const [checks, setChecks] = useState({ biz: a.docs.biz, ecom: a.docs.ecom, dup: true, cat: true, kc: a.cat !== 'digital' });
  const c = categories.find((x) => x.id === a.cat) ?? { name: a.cat, commission: 0 };
  const timeline = useMemo(() => history.filter((h) => h.appId === a.id).sort((x, y) => x.at - y.at), [history, a.id]);
  const allChecked = Object.values(checks).every(Boolean);

  const submit = (status, reason, msg) =>
    decide.mutate(
      { id: a.id, status, reason },
      { onSuccess: () => { setModal(null); toast(msg); void nav('/admin/applications'); } },
    );

  return (
    <div>
      <PageHead crumbs="판매자 > 입점 심사" title={<>{a.storeName} <span className="text-[14px] font-normal text-mute num ml-1">{a.id}</span></>} desc={`신청일시 ${ymdhm(a.applied)}`}
        right={<StatusPill s={a.status} />} />
      {a.note && <div className={cx('mb-4 px-4 py-3 text-[13px]', a.status === '반려' ? 'bg-rust-soft text-rust' : 'bg-amber-soft text-amber')}>{a.note}</div>}
      <div className="grid xl:grid-cols-[1fr_360px] gap-4">
        <div className="space-y-4">
          <div className="panel">
            <div className="panel-head"><span className="panel-title">신청 정보</span></div>
            <div className="p-5"><KV cols={2} rows={[['스토어명', a.storeName], ['대표자', a.owner], ['사업자 구분', a.bizType], ['사업자번호', <span className="num">{a.bizNo}</span>], ['통신판매업', <span className="num">{a.ecomNo}</span>], ['카테고리', `${c.name} (수수료 ${pct(c.commission)})`], ['연락처', a.phone], ['이메일', a.email], ['월 예상매출', a.expected], ['운영 채널', '자사몰 / 인스타그램']]} /></div>
          </div>
          <div className="panel">
            <div className="panel-head"><span className="panel-title">스토어 소개 · 판매 예정 상품</span></div>
            <div className="p-5">
              <p className="text-[14px] text-ink-2 leading-relaxed">{a.intro}</p>
              <ul className="mt-4 border-t border-line">{a.products.map((p) => <li key={p} className="py-2.5 border-b border-line text-[13px] flex justify-between">{p}<span className="text-mute">{c.name}</span></li>)}</ul>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head"><span className="panel-title">제출 서류</span></div>
            <div className="p-5 grid sm:grid-cols-2 gap-2">
              {DOCS.map(([k, l]) => (
                <div key={k} className={cx('flex items-center gap-3 border p-3', a.docs[k] ? 'border-line' : 'border-dashed border-rust/50 bg-rust-soft/40')}>
                  <FileText size={18} className={a.docs[k] ? 'text-ink' : 'text-rust'} />
                  <div className="flex-1 text-[13px]"><div className="font-semibold">{l}</div><div className="text-[11.5px] text-mute">{a.docs[k] ? `${l.replace(/\s/g, '')}.pdf` : '미제출'}</div></div>
                  {a.docs[k] && <button className="btn btn-ghost btn-xs"><ExternalLink size={13} /> 열기</button>}
                </div>
              ))}
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
              <textarea rows={3} className="field text-[13px] mt-2" placeholder="내부 심사 메모 (판매자에게 노출되지 않음)" />
            </div>
          </div>
          {['심사대기', '보완요청'].includes(a.status) && (
            <div className="panel p-5 space-y-2">
              <button onClick={() => setModal('approve')} disabled={!allChecked} className="btn btn-ink w-full">승인</button>
              <button onClick={() => setModal('supplement')} className="btn btn-line w-full">보완 요청</button>
              <button onClick={() => setModal('reject')} className="btn btn-line w-full text-rust">반려</button>
              {!allChecked && <p className="text-[11.5px] text-mute text-center">체크리스트를 모두 확인해야 승인할 수 있어요</p>}
            </div>
          )}
          <div className="panel">
            <div className="panel-head"><span className="panel-title">처리 이력</span></div>
            <ol className="p-5 space-y-3 text-[13px]">
              {timeline.map((h) => (
                <li key={h.id} className="relative pl-4 border-l-2 border-line">
                  <div className="flex items-center gap-1.5">
                    {h.from && <><StatusPill s={h.from} /><span className="text-mute">→</span></>}
                    <StatusPill s={h.to} />
                  </div>
                  <div className="mt-1 text-ink-2">{h.reason}</div>
                  <div className="text-[11.5px] text-mute num">{ymdhm(h.at)} · {h.by}</div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <Modal open={modal === 'approve'} onClose={() => setModal(null)} title="입점 승인" width={480}
        footer={<><button className="btn btn-line btn-sm" onClick={() => setModal(null)}>취소</button><button className="btn btn-ink btn-sm" disabled={decide.isPending} onClick={() => submit('승인', '서류 · 카테고리 적합성 확인 완료', `${a.storeName} 입점 승인 · 판매자 계정 발급 메일 발송`)}>승인 확정</button></>}>
        <div className="space-y-4 text-[14px]">
          <KV rows={[['스토어', a.storeName], ['스토어 URL', <span className="num">gotgan.kr/store/{a.storeName === '숲속제과' ? 'forest-bake' : 'new-store'}</span>], ['판매수수료', `${pct(c.commission)} (카테고리 기본)`], ['결제수수료', pct(PAYMENT_FEE, 1)], ['판매자 등급', '새싹 (시작 등급)']]} />
          <Checkbox checked={promo} onChange={setPromo} label="신규 입점 프로모션 적용 (3개월 판매수수료 50%)" />
          <p className="text-[12px] text-mute">승인 시: ① 스토어 생성(상태: 운영중) ② 판매자센터 계정 발급 ③ 승인 안내 메일/알림톡 발송 ④ 메인 신규 스토어 2주 노출</p>
        </div>
      </Modal>
      <Modal open={modal === 'supplement'} onClose={() => setModal(null)} title="보완 요청" width={480}
        footer={<><button className="btn btn-line btn-sm" onClick={() => setModal(null)}>취소</button><button className="btn btn-ink btn-sm" disabled={decide.isPending} onClick={() => submit('보완요청', '서류 보완 요청', '보완 요청을 보냈어요 (7일 내 미보완 시 자동 반려)')}>요청 보내기</button></>}>
        <div className="space-y-2 text-[14px]">{['사업자등록증 재제출', '통신판매업 신고증 제출', 'KC 인증서 제출', '상품 사진 추가 제출', '정품 증빙 서류'].map((x) => <Checkbox key={x} checked={x === 'KC 인증서 제출' && a.cat === 'digital'} label={x} />)}</div>
        <textarea rows={3} className="field mt-4" placeholder="판매자에게 전달할 메시지" />
      </Modal>
      <Modal open={modal === 'reject'} onClose={() => setModal(null)} title="입점 반려" width={480}
        footer={<><button className="btn btn-line btn-sm" onClick={() => setModal(null)}>취소</button><button className="btn btn-sm bg-rust text-white border-rust" disabled={decide.isPending} onClick={() => submit('반려', '입점 기준 미충족', '반려 처리 · 사유가 신청자에게 발송되었어요')}>반려 확정</button></>}>
        <label className="label">반려 사유</label>
        <select className="field mb-3"><option>사업자 정보 확인 불가</option><option>판매 금지 품목 포함</option><option>정품/인증 증빙 불가</option><option>기존 스토어 중복 입점</option><option>기타</option></select>
        <textarea rows={3} className="field" placeholder="상세 사유 (신청자에게 전달됨)" />
        <p className="text-[12px] text-mute mt-2">반려 후 30일 이내 재신청이 제한됩니다.</p>
      </Modal>
    </div>
  );
}
