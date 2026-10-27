// 임시 점검 화면 — API 직접 호출 (담당 구지훈, 팀원 공용). 화면이 아직 목업이어도 로그인한 계정으로 실제 API 를 불러 응답을 본다
// axiosInstance 를 그대로 써서 토큰 · 재발급 · 게이트웨이 경로는 실제 화면과 같다. 예시는 10/27 기준으로 배포된 API 만
import { useState } from 'react';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { cx } from '@/shared/utils/format';

// 예시 — 누가 · 무엇을 · 어떤 계정으로. 본문은 계약 문서(docs/api/*.md) 그대로. 새 API 가 배포되면 여기에 한 줄씩 추가
const PRESETS = [
  { owner: '박지연', label: '판매자 상품 목록', role: '판매자', method: 'GET', path: '/api/seller/products' },
  { owner: '박지연', label: '판매자 상품 상세 (시드 101)', role: '판매자(seller1)', method: 'GET', path: '/api/seller/products/101' },
  {
    owner: '박지연', label: '판매자 상품 등록', role: '판매자', method: 'POST', path: '/api/seller/products',
    body: {
      categoryId: 101, name: '점검용 감귤 3kg', price: 19000, discountRate: 10, description: '<p>점검용 상품</p>', material: '감귤', origin: '제주',
      option1Name: null, option2Name: null, options: [{ productOptionId: null, option1Value: null, option2Value: null, extraPrice: 0, stock: 5 }],
      imageKeys: ['products/1/0f8fad5b-d9cb-469f-a165-70867728950e.jpg'], status: 'STOPPED',
    },
  },
  {
    owner: '박지연', label: '입점 서류 업로드 주소 발급', role: '구매자', method: 'POST', path: '/api/seller/apply/documents/presign',
    body: { files: [{ docType: 'BUSINESS_REG', contentType: 'application/pdf', size: 120000 }] },
  },
  { owner: '박지연', label: '카테고리 트리', role: '누구나', method: 'GET', path: '/api/categories' },
  { owner: '이경석', label: '장바구니 담기 (시드 옵션 10101)', role: '구매자', method: 'POST', path: '/api/carts/items', body: { productOptionId: 10101, quantity: 1 } },
  { owner: '이경석', label: '내 주문', role: '구매자', method: 'GET', path: '/api/orders' },
  { owner: '이경석', label: '내 클레임', role: '구매자', method: 'GET', path: '/api/claims' },
  { owner: '이경석', label: '판매자 주문 목록', role: '판매자', method: 'GET', path: '/api/seller/order-items' },
  { owner: '이경석', label: '판매자 클레임', role: '판매자', method: 'GET', path: '/api/seller/claims' },
  { owner: '이경석', label: '내 정보', role: '로그인', method: 'GET', path: '/api/users/me' },
  { owner: '구지훈', label: '내 알림', role: '로그인', method: 'GET', path: '/api/notifications' },
  { owner: '구지훈', label: '판매자 정산 내역', role: '판매자', method: 'GET', path: '/api/seller/settlements' },
  { owner: '구지훈', label: '관리자 대시보드', role: '관리자', method: 'GET', path: '/api/admin/dashboard' },
];
const OWNERS = [...new Set(PRESETS.map((p) => p.owner))];
const HAS_BODY = ['POST', 'PUT', 'PATCH', 'DELETE'];

export default function ApiConsole() {
  const [method, setMethod] = useState('GET');
  const [path, setPath] = useState('/api/categories');
  const [body, setBody] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const pick = (p) => {
    setMethod(p.method);
    setPath(p.path);
    setBody(p.body ? JSON.stringify(p.body, null, 2) : '');
    setResult(null);
  };

  const send = async () => {
    let data;
    try {
      data = HAS_BODY.includes(method) && body.trim() ? JSON.parse(body) : undefined;
    } catch {
      setResult({ status: '본문 오류', data: 'JSON 형식이 아니에요' });
      return;
    }
    setBusy(true);
    try {
      const res = await axiosInstance.request({ method, url: path, data });
      setResult({ status: res.status, data: res.data });
    } catch (err) {
      setResult({ status: err.response?.status ?? '연결 실패', data: err.response?.data ?? err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel p-5 space-y-3">
      <div className="panel-title">⑤ API 직접 호출 (팀원 공용) — 지금 로그인한 계정으로</div>
      {OWNERS.map((o) => (
        <div key={o} className="flex flex-wrap items-center gap-1.5">
          <span className="w-14 text-[12px] text-mute">{o}</span>
          {PRESETS.filter((p) => p.owner === o).map((p) => (
            <button key={p.label} onClick={() => pick(p)} title={`${p.method} ${p.path} · ${p.role}`} className="btn btn-line btn-xs">{p.label}</button>
          ))}
        </div>
      ))}
      <div className="flex gap-2">
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="field w-28">
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => <option key={m}>{m}</option>)}
        </select>
        <input value={path} onChange={(e) => setPath(e.target.value)} className="field flex-1 num" placeholder="/api/..." />
        <button onClick={send} disabled={busy || !path.startsWith('/api/')} className="btn btn-ink btn-sm">보내기</button>
      </div>
      {HAS_BODY.includes(method) && (
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} className="field num text-[12px]" placeholder='본문 JSON (없으면 비워 두기)' />
      )}
      {result && (
        <div>
          <div className={cx('text-[12.5px] font-bold', String(result.status).startsWith('2') ? 'text-moss' : 'text-rust')}>응답 {result.status}</div>
          <pre className="text-[12px] bg-cream p-3 mt-1 max-h-[360px] overflow-auto whitespace-pre-wrap">{JSON.stringify(result.data, null, 2)}</pre>
        </div>
      )}
      <p className="text-[12px] text-mute">/api/ 로 시작하는 경로만 — 게이트웨이를 거쳐 화면과 같은 권한 검사를 받아요. 401 = 로그인 필요 · 403 = 그 역할이 아님 · 502 = 뒤 서비스 장애 또는 미구현 의존</p>
    </section>
  );
}
