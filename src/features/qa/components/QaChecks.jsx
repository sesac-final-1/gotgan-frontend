// 임시 점검 화면 (/qa) — 담당 구지훈. 화면 연결이 아직 안 된 실제 API 를 직접 눌러 보고, 이 화면 안에서 생긴 CSP 위반을 모아 보여 준다
// TODO(구지훈): 장바구니 · 리뷰 · 스토어 화면이 실제 API 로 바뀌면 이 화면과 /qa 경로를 지운다 (시연 전 삭제)
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { useCreateOrderMutation } from '@/features/order/hooks/useCreateOrderMutation';
import { usePayOrderMutation } from '@/features/payment/hooks/usePayOrderMutation';
import { PAY_METHODS } from '@/features/payment/constants';
import { useMyAddressesQuery } from '@/features/user/hooks/useMyAddressesQuery';
import ReportModal from '@/features/report/components/ReportModal';
import { useAdminStoreProductsQuery } from '@/features/admin/hooks/useAdminStoreProductsQuery';
import { useBlockProductMutation } from '@/features/admin/hooks/useBlockProductMutation';
import { PostcodeSearch } from '@/shared/components/common/PostcodeSearch';
import { PageHead, StatusPill } from '@/shared/components/ui';
import { toast } from '@/shared/stores/toastStore';
import { won } from '@/shared/utils/format';

// 시드 상품의 첫 옵션 (product 시드 — 옵션 id = 상품 × 100 + 1)
const SEED_OPTIONS = [
  { id: 10101, label: '서귀포 노지 햇감귤 5kg · 로얄과 (산골농부 박씨네)' },
  { id: 20101, label: '분청 손잡이 머그 · 백토 (토담공방)' },
  { id: 110101, label: '프렌치 리넨 오버핏 셔츠 · 오트밀 / S (오롯이 리넨)' },
  { id: 180101, label: '시카 9 진정 토너 · 단품 (피부정원)' },
];

const has = (user, role) => user?.roles?.includes(role);

export default function QaChecks() {
  const user = useAuthStore((s) => s.user);
  const [violations, setViolations] = useState([]);

  // 이 화면에 있는 동안 생긴 CSP 위반 (Report-Only — 막지는 않고 기록만)
  useEffect(() => {
    const onViolation = (e) => setViolations((v) => [...v, `${e.violatedDirective} ← ${e.blockedURI || '(inline)'}`]);
    document.addEventListener('securitypolicyviolation', onViolation);
    return () => document.removeEventListener('securitypolicyviolation', onViolation);
  }, []);

  return (
    <div className="max-w-[960px] mx-auto px-4 md:px-6 pt-10 pb-20 space-y-6">
      <PageHead title="임시 점검 화면" desc={`화면 연결 전 실제 API 확인용 — 로그인: ${user ? `${user.name} (${user.roles?.join(', ')})` : '안 함'}`} />
      <section className="panel p-5">
        <div className="panel-title mb-2">CSP 위반 (이 화면에서 생긴 것 {violations.length}건)</div>
        {violations.length ? <ul className="text-[12px] num space-y-1">{violations.map((v, i) => <li key={i}>{v}</li>)}</ul>
          : <p className="text-[12.5px] text-mute">없음 — 결제창 · 우편번호를 열어 본 뒤에도 0이면 정상</p>}
      </section>
      {!user && <p className="panel p-5 text-[13px]">아래 점검은 로그인이 필요해요. <Link to="/login" state={{ from: '/qa' }} className="underline">로그인</Link></p>}
      {has(user, 'BUYER') && <PaymentCheck />}
      <PostcodeCheck />
      {(has(user, 'BUYER') || has(user, 'SELLER')) && <ReportCheck />}
      {has(user, 'ADMIN') && <BlockCheck />}
    </div>
  );
}

// ① 결제 — 시드 상품 1개로 주문 생성 → 포트원 결제창 → 결제 확인 (주문서는 장바구니가 목업이라 아직 못 씀)
function PaymentCheck() {
  const { data: addresses = [] } = useMyAddressesQuery();
  const [optionId, setOptionId] = useState(SEED_OPTIONS[0].id);
  const [method, setMethod] = useState(PAY_METHODS[0].label);
  const [result, setResult] = useState(null);
  const createOrder = useCreateOrderMutation();
  const payOrder = usePayOrderMutation();
  const addr = addresses[0];

  const pay = async () => {
    setResult(null);
    let created;
    try {
      created = await createOrder.mutateAsync({ items: [{ productOptionId: optionId, quantity: 1 }], receiverName: addr.name, receiverPhone: addr.phone,
        zipcode: addr.zip, address1: addr.addr, address2: addr.detail || null, deliveryMemo: null, usePoint: 0 });
    } catch (err) {
      setResult({ status: 'ORDER_FAILED', message: err.response?.data?.message ?? err.message });
      return;
    }
    setResult(await payOrder.mutateAsync({ ...created, payMethod: PAY_METHODS.find((m) => m.label === method) }));
  };

  return (
    <section className="panel p-5 space-y-3">
      <div className="panel-title">① 결제 (구매자) — 테스트 채널이라 실제 출금 없음</div>
      <p className="text-[12px] text-rust">주문 생성이 product 가격 조회 · 재고 예약 내부 API(product.md 1 · 4절, 박지연 구현 예정)를 불러서, 그 API 가 배포되기 전에는 "주문하지 못했어요"(502)가 정상이에요</p>
      <select value={optionId} onChange={(e) => setOptionId(Number(e.target.value))} className="field">
        {SEED_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      <div className="flex flex-wrap gap-2">
        {PAY_METHODS.map((m) => <button key={m.label} onClick={() => setMethod(m.label)} className={`btn btn-sm ${method === m.label ? 'btn-ink' : 'btn-line'}`}>{m.label}</button>)}
      </div>
      {addr ? <p className="text-[12.5px] text-mute">배송지: {addr.name} · ({addr.zip}) {addr.addr}</p>
        : <p className="text-[12.5px] text-rust">배송지가 없어요 — <Link to="/mypage/addresses" className="underline">마이페이지 배송지</Link>에서 먼저 등록 (우편번호 검색도 함께 점검)</p>}
      <button className="btn btn-ink btn-sm" disabled={!addr || createOrder.isPending || payOrder.isPending} onClick={pay}>주문하고 결제창 열기</button>
      {result && <pre className="text-[12px] bg-cream p-3 whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>}
      <p className="text-[12px] text-mute">결제 후 <Link to="/mypage/orders" className="underline">내 주문</Link> · 판매자 계정 <code>/seller/orders</code> 에서 같은 주문이 보이는지</p>
    </section>
  );
}

// ② 우편번호 — 카카오 우편번호 스크립트 · 검색 화면 (CSP script · frame)
function PostcodeCheck() {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(null);
  return (
    <section className="panel p-5 space-y-3">
      <div className="panel-title">② 우편번호 검색 (로그인 불필요)</div>
      <button className="btn btn-line btn-sm" onClick={() => setOpen((v) => !v)}>{open ? '닫기' : '검색 열기'}</button>
      {open && <PostcodeSearch onSelect={(a) => { setPicked(a); setOpen(false); }} />}
      {picked && <p className="text-[13px]">({picked.zip}) {picked.addr}</p>}
    </section>
  );
}

// ③ 신고 접수 — 공용 신고 모달 그대로 (리뷰 · 회원 화면에 아직 버튼이 없음). 접수 후 관리자 /admin/reports 에서 처리
function ReportCheck() {
  const [type, setType] = useState('USER');
  const [id, setId] = useState('111');
  const [target, setTarget] = useState(null);
  return (
    <section className="panel p-5 space-y-3">
      <div className="panel-title">③ 신고 접수 (구매자 · 판매자)</div>
      <div className="flex flex-wrap gap-2 items-center">
        <select value={type} onChange={(e) => setType(e.target.value)} className="field w-32"><option value="USER">회원</option><option value="REVIEW">리뷰</option></select>
        <input value={id} onChange={(e) => setId(e.target.value)} className="field num w-28" placeholder="대상 id" />
        <button className="btn btn-ink btn-sm" onClick={() => setTarget({ type, id: Number(id) })}>신고하기</button>
      </div>
      <p className="text-[12px] text-mute">회원 111 = 시드 조회용 회원(오준서) · 리뷰는 review 내부 API 배포 전이라 Mock 대상(아무 번호) · 같은 대상 두 번이면 409 · 본인은 400</p>
      <ReportModal target={target} onClose={() => setTarget(null)} />
    </section>
  );
}

// ④ 상품 강제 판매중지 (관리자) — 스토어 상세 화면이 B안(목업)이라 실제 상품으로 여기서 점검
function BlockCheck() {
  const [storeId, setStoreId] = useState('1');
  const { data: products = [], isFetching, error } = useAdminStoreProductsQuery(storeId);
  const block = useBlockProductMutation();
  const change = (p, blocked) => {
    const reason = blocked ? window.prompt('판매중지 사유 (판매자에게 보임)') : null;
    if (blocked && !reason?.trim()) return;
    block.mutate({ productId: p.productId, storeId, blocked, reason }, {
      onSuccess: (r) => toast(`${p.name} → ${r.status}`),
      onError: (err) => toast(err.response?.data?.message ?? '변경하지 못했어요'),
    });
  };
  return (
    <section className="panel p-5 space-y-3">
      <div className="panel-title">④ 상품 강제 판매중지 · 해제 (관리자)</div>
      <div className="flex items-center gap-2 text-[13px]">스토어 id
        <select value={storeId} onChange={(e) => setStoreId(e.target.value)} className="field w-28">{['1', '2', '11', '12', '13', '15', '17', '18', '19'].map((s) => <option key={s}>{s}</option>)}</select>
        {isFetching && <span className="text-mute">불러오는 중…</span>}
      </div>
      {error && <p className="text-rust text-[12.5px]">{error.response?.data?.message ?? error.message}</p>}
      <table className="tbl">
        <thead><tr><th>상품</th><th className="text-right">판매가</th><th className="text-right">재고</th><th>상태</th><th>미노출</th><th /></tr></thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.productId}>
              <td><div className="flex items-center gap-2">{p.imageUrl && <img src={p.imageUrl} alt="" className="w-8 h-8 object-cover" />}{p.name}</div></td>
              <td className="text-right num">{won(p.salePrice)}</td>
              <td className="text-right num">{p.totalStock}</td>
              <td><StatusPill s={p.status} />{p.statusReason && <div className="text-[11px] text-mute">{p.statusReason}</div>}</td>
              <td className="text-[12px]">{p.hiddenReason ?? '-'}</td>
              <td>{p.status === 'BLOCKED'
                ? <button className="btn btn-ghost btn-xs" onClick={() => change(p, false)}>해제</button>
                : <button className="btn btn-ghost btn-xs text-rust" onClick={() => change(p, true)}>강제중지</button>}</td>
            </tr>
          ))}
          {!products.length && !isFetching && <tr><td colSpan={6} className="text-center text-mute py-4">상품 없음</td></tr>}
        </tbody>
      </table>
    </section>
  );
}
