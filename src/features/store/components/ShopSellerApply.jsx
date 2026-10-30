// 입점 신청 (4단계) · 내 신청 상태 — 담당 박지연. 계약: backend docs/api/store.md 2 · 2-1 · 2-2절
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useCategoriesQuery } from '@/features/product/hooks/useCategoriesQuery';
import { useMyApplicationQuery } from '@/features/store/hooks/useMyApplicationQuery';
import { useApplySellerMutation } from '@/features/store/hooks/useApplySellerMutation';
import { APPLICATION_STATUS_LABEL, BANKS, BIZ_TYPES, DOC_TYPES, DOC_TYPE_LABEL, EXPECTED_SALES, PRODUCT_PHOTO_MAX, PRODUCT_PHOTO_MIN } from '@/features/store/constants';
import { formatProblem } from '@/features/store/applyRules';
import { Doc, Field } from '@/features/store/components/ApplyFormParts';
import ShopSellerResubmit from '@/features/store/components/ShopSellerResubmit';
import { queryKeys } from '@/shared/api/queryKeys';
import { Checkbox, Empty } from '@/shared/components/ui';
import { PostcodeSearch } from '@/shared/components/common/PostcodeSearch';
import { toast } from '@/shared/stores/toastStore';
import { cx, ymd, ymdhm } from '@/shared/utils/format';

/* 흐름: GET /api/seller/apply/me → 없으면 신청 폼, 있으면 상태 화면(심사대기 · 보완요청 · 반려 · 승인). 반려는 재신청 가능일이 지나면 폼으로
   제출: 서류 presign → S3 PUT → POST /api/seller/apply → me 다시 조회 → 심사대기 화면. 화면은 빈칸 · 개수 · 약관 · 형식 4칸만 보고 나머지는 서버 400 메시지로
   보완요청이면 "보완 제출하기" → ShopSellerResubmit(2-3절) */
const STEPS = ['판매자 정보', '스토어 · 상품', '서류 제출', '정산 · 약관'];
const ACTOR_LABEL = { APPLICANT: '신청자', ADMIN: '곳간 운영팀', SYSTEM: '시스템' };

export default function ShopSellerApply() {
  const { data: me, isLoading, isError } = useMyApplicationQuery();
  const [reapply, setReapply] = useState(false);
  const [resubmit, setResubmit] = useState(false);
  if (isLoading) return <p className="text-mute py-10 text-center">불러오는 중…</p>;
  if (isError) return <Empty title="신청 상태를 불러오지 못했어요" desc="잠시 후 다시 시도해 주세요." />;
  if (me?.status === 'SUPPLEMENT' && resubmit && me.submitted) return <ShopSellerResubmit me={me} onCancel={() => setResubmit(false)} />;
  if (me && !reapply) return <ApplicationStatus me={me} onReapply={() => setReapply(true)} onResubmit={() => { setResubmit(true); window.scrollTo(0, 0); }} />;
  return <ApplyForm />;
}

/* ─── 내 신청 상태 (2-2절) ─── */
function ApplicationStatus({ me, onReapply, onResubmit }) {
  const canReapply = me.status === 'REJECTED' && (!me.reapplyAvailableAt || me.reapplyAvailableAt <= new Date());
  const TITLE = {
    PENDING: ['Under review', '입점 신청을 심사하고 있습니다', '심사 결과는 영업일 기준 3일 이내 이메일로 안내드려요.'],
    SUPPLEMENT: ['Supplement requested', '보완이 필요한 항목이 있습니다', `${me.supplementDueAt ? ymd(me.supplementDueAt) : ''}까지 보완하지 않으면 자동으로 반려돼요.`],
    REJECTED: ['Rejected', '입점 신청이 반려되었습니다', me.reapplyAvailableAt ? `${ymd(me.reapplyAvailableAt)}부터 다시 신청할 수 있어요.` : '다시 신청할 수 있어요.'],
    APPROVED: ['Approved', '입점이 승인되었습니다', '판매자 권한은 다시 로그인하면 적용돼요. 판매자센터에서 상품을 등록해 보세요.'],
  }[me.status] ?? ['', APPLICATION_STATUS_LABEL[me.status] ?? me.status, ''];
  return (
    <div className="max-w-[640px] mx-auto px-4 pt-20">
      <div className="eyebrow">{TITLE[0]}</div>
      <h1 className="mt-2 text-[28px] font-bold tracking-tight">{TITLE[1]}</h1>
      <p className="mt-2 text-ink-2 text-sm">접수번호 <b className="num">{me.applicationNo}</b> · {me.storeName} · {TITLE[2]}</p>
      {me.statusReason && (
        <div className="mt-6 bg-cream p-5 text-[13px] leading-relaxed">
          <b>{me.status === 'REJECTED' ? '반려 사유' : '보완 요청'}</b>
          <p className="mt-1 text-ink-2">{me.statusReason}</p>
          {me.requestedDocs.length > 0 && <p className="mt-2 text-ink-2">다시 낼 서류: {me.requestedDocs.map((d) => DOC_TYPE_LABEL[d] ?? d).join(' · ')}</p>}
        </div>
      )}
      <ol className="mt-10 border-l-2 border-line ml-2">
        {me.history.map((h, i) => (
          <li key={i} className="relative pl-6 pb-7 last:pb-0">
            <span className={cx('absolute -left-[7px] top-1 w-3 h-3 rounded-full border-2', i === me.history.length - 1 ? 'bg-point border-point' : 'bg-white border-line-2')} />
            <div className="font-semibold text-[15px]">{String(i + 1).padStart(2, '0')}. {APPLICATION_STATUS_LABEL[h.toStatus] ?? h.toStatus}</div>
            <div className="text-[13px] text-mute mt-0.5">{h.changedAt ? ymdhm(h.changedAt) : ''} · {ACTOR_LABEL[h.actor] ?? h.actor}{h.reason && ` · ${h.reason}`}</div>
          </li>
        ))}
      </ol>
      <div className="mt-10 grid grid-cols-2 gap-2">
        <Link to="/" className="btn btn-line btn-lg">쇼핑몰로</Link>
        {me.status === 'APPROVED' && <Link to="/seller" className="btn btn-ink btn-lg">판매자센터로 →</Link>}
        {canReapply && <button type="button" onClick={onReapply} className="btn btn-ink btn-lg">다시 신청하기</button>}
        {me.status === 'SUPPLEMENT' && me.submitted && <button type="button" onClick={onResubmit} className="btn btn-ink btn-lg">보완 제출하기</button>}
      </div>
    </div>
  );
}

/* ─── 신청 폼 (2절) ─── */
const EMPTY_FORM = {
  bizType: 'INDIVIDUAL', companyName: '', ownerName: '', bizRegNo: '', ecommerceRegNo: '', managerPhone: '', managerEmail: '', businessAddress: '',
  storeName: '', slug: '', categoryId: null, intro: '', expectedMonthlySales: '', salesChannel: '',
  bank: BANKS[0], number: '', holder: '',
};
const EMPTY_DOCS = { BUSINESS_REG: null, ECOMMERCE_REG: null, BANK_COPY: null, PRODUCT_PHOTO: [] };
const REQUIRED = [
  ['companyName', 'ownerName', 'bizRegNo', 'ecommerceRegNo', 'managerPhone', 'managerEmail', 'businessAddress'],
  ['storeName', 'slug'],
  [],
  ['number', 'holder'],
];
// 단계별로 형식을 미리 볼 칸(규칙 · 문구는 applyRules — 서버와 같음)
const STEP_FORMAT = [['bizRegNo', 'managerPhone', 'managerEmail'], ['slug'], [], []];

function ApplyForm() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: categories = [] } = useCategoriesQuery();
  const apply = useApplySellerMutation();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [products, setProducts] = useState([{ name: '', subCategory: '', price: '' }, { name: '', subCategory: '', price: '' }]);
  const [docs, setDocs] = useState(EMPTY_DOCS);
  const [agree, setAgree] = useState({ sellerTerms: false, electronicFinance: false, privacy: false, marketing: false });
  const [postcode, setPostcode] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const cat = categories.find((x) => x.id === form.categoryId) ?? categories[0];
  const setProduct = (i, k, v) => setProducts(products.map((p, j) => (j === i ? { ...p, [k]: v } : p)));

  // 화면 검사는 최소 — 빈칸 · 상품 2개 이상 · 서류 개수 · 필수 약관. 형식(사업자번호 · 주소 규칙 등)은 서버 400 메시지로
  const problem = (s) => {
    if (REQUIRED[s].some((k) => !String(form[k]).trim())) return '필수 항목을 모두 입력해 주세요';
    const bad = formatProblem(STEP_FORMAT[s], form);
    if (bad) return bad;
    if (s === 1) {
      if (!cat) return '카테고리를 불러오는 중이에요';
      if (products.length < 2 || products.some((p) => !p.name.trim() || !(Number(p.price) > 0))) return '판매 예정 상품을 2개 이상, 상품명과 판매가까지 입력해 주세요';
    }
    if (s === 2) {
      if (!docs.BUSINESS_REG || !docs.ECOMMERCE_REG || !docs.BANK_COPY) return '서류 3종을 모두 올려 주세요';
      if (docs.PRODUCT_PHOTO.length < PRODUCT_PHOTO_MIN || docs.PRODUCT_PHOTO.length > PRODUCT_PHOTO_MAX) return `상품 사진은 ${PRODUCT_PHOTO_MIN}~${PRODUCT_PHOTO_MAX}장이에요`;
    }
    if (s === 3 && !(agree.sellerTerms && agree.electronicFinance && agree.privacy)) return '필수 약관에 동의해 주세요';
    return null;
  };
  const next = () => { const p = problem(step); p ? toast(p) : setStep(step + 1); };

  const submit = () => {
    const p = problem(3);
    if (p) { toast(p); return; }
    const { bank, number, holder, intro, expectedMonthlySales, salesChannel, ...rest } = form;
    apply.mutate({
      ...rest,
      categoryId: cat.id,
      intro: intro.trim() || undefined,
      expectedMonthlySales: expectedMonthlySales || undefined,
      salesChannel: salesChannel.trim() || undefined,
      representativeProducts: products.map((x) => ({ name: x.name.trim(), subCategory: x.subCategory || cat.subs[0] || '', price: Number(x.price) })),
      settlementAccount: { bank, number, holder },
      agreements: agree,
      docs: [...DOC_TYPES.filter((t) => !t.multiple).map((t) => ({ docType: t.value, file: docs[t.value] })),
        ...docs.PRODUCT_PHOTO.map((file) => ({ docType: 'PRODUCT_PHOTO', file }))],
    }, {
      onSuccess: () => window.scrollTo(0, 0), // me 가 다시 조회되며 "심사 중" 화면으로
      onError: (e) => {
        const code = e.response?.data?.code;
        toast(e.response?.data?.message ?? e.message ?? '신청을 보내지 못했어요. 잠시 후 다시 시도해 주세요.');
        if (code === 'APPLY_STORE_ALREADY_EXISTS') void nav('/seller'); // 1인 1스토어
        else if (code === 'APPLY_SLUG_DUPLICATED' || code === 'APPLY_STORE_NAME_DUPLICATED') setStep(1);
        else if (code === 'APPLY_IN_PROGRESS' || code === 'APPLY_REAPPLY_RESTRICTED') void qc.invalidateQueries({ queryKey: queryKeys.store.myApplication() }); // 상태 화면으로
      },
    });
  };

  return (
    <div className="max-w-[1080px] mx-auto px-4 md:px-6 pt-10 grid lg:grid-cols-[300px_1fr] gap-10">
      <aside>
        <div className="lg:sticky lg:top-24">
          <div className="eyebrow">Seller onboarding</div>
          <h1 className="mt-2 text-[28px] font-bold tracking-tight leading-tight">곳간에<br />가게 열기</h1>
          <ol className="mt-8 space-y-1">
            {STEPS.map((s, i) => (
              <li key={s} className={cx('flex items-center gap-3 h-11 px-3 text-[14px]', i === step ? 'bg-ink text-white font-semibold' : i < step ? 'text-ink' : 'text-mute')}>
                <span className={cx('w-6 h-6 flex items-center justify-center text-[12px] num border', i === step ? 'border-white' : i < step ? 'bg-ink text-white border-ink' : 'border-line-2')}>{i < step ? <Check size={13} /> : i + 1}</span>{s}
              </li>
            ))}
          </ol>
          <div className="mt-8 bg-cream p-5 text-[13px] leading-relaxed">
            <b>입점 혜택</b>
            <ul className="mt-2 space-y-1 text-ink-2">
              <li>· 첫 3개월 판매수수료 50% 지원</li>
              <li>· 주 1회 정산 (구매확정 기준)</li>
              <li>· 신규 스토어 메인 노출 2주</li>
            </ul>
          </div>
        </div>
      </aside>

      <div className="border-t-2 border-ink pt-6">
        {step === 0 && (
          <div className="space-y-5">
            <h2 className="text-[20px] font-bold">판매자 정보</h2>
            <Field label="사업자 구분" req>
              <div className="grid grid-cols-2 gap-2">
                {BIZ_TYPES.map((t) => <button key={t.value} type="button" onClick={() => setForm({ ...form, bizType: t.value })} className={cx('h-11 border text-sm', form.bizType === t.value ? 'border-ink border-2 font-bold' : 'border-line-2')}>{t.label}</button>)}
              </div>
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="상호명" req><input className="field" placeholder="사업자등록증 상 상호" value={form.companyName} onChange={set('companyName')} /></Field>
              <Field label="대표자명" req><input className="field" value={form.ownerName} onChange={set('ownerName')} /></Field>
              <Field label="사업자등록번호" req><input className="field num" placeholder="000-00-00000" value={form.bizRegNo} onChange={set('bizRegNo')} /></Field>
              <Field label="통신판매업 신고번호" req><input className="field num" placeholder="2026-서울성동-0000" value={form.ecommerceRegNo} onChange={set('ecommerceRegNo')} /></Field>
              <Field label="담당자 휴대폰" req><input className="field num" placeholder="010-0000-0000" value={form.managerPhone} onChange={set('managerPhone')} /></Field>
              <Field label="담당자 이메일" req hint="심사 결과를 이 주소로 보내드려요."><input className="field" type="email" placeholder="seller@example.com" value={form.managerEmail} onChange={set('managerEmail')} /></Field>
            </div>
            <Field label="사업장 주소" req>
              <div className="flex gap-2"><input className="field" placeholder="주소 검색 후 상세 주소를 덧붙여 주세요" value={form.businessAddress} onChange={set('businessAddress')} /><button type="button" onClick={() => setPostcode(true)} className="btn btn-line shrink-0">검색</button></div>
              {postcode && <div className="mt-2"><PostcodeSearch onSelect={({ addr }) => { setForm({ ...form, businessAddress: addr }); setPostcode(false); }} /></div>}
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-[20px] font-bold">스토어 · 카테고리 · 판매 예정 상품</h2>
            <Field label="스토어 이름" req hint="쇼핑몰에 노출되는 이름입니다. 승인 후 변경하려면 관리자 승인이 필요해요."><input className="field" placeholder="예) 오롯이 리넨" value={form.storeName} onChange={set('storeName')} /></Field>
            <Field label="스토어 주소" req hint="영소문자 · 숫자 · 하이픈 3~30자. 승인 후 변경할 수 없어요."><div className="flex items-center border border-line-2 h-10 px-3 text-sm"><span className="text-mute">gotgan.kr/store/</span><input className="flex-1 outline-none" placeholder="my-store" value={form.slug} onChange={set('slug')} aria-label="스토어 주소" /></div></Field>
            <Field label="대표 카테고리" req hint="카테고리에 따라 판매수수료가 달라집니다.">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {categories.map((x) => (
                  <button key={x.id} type="button" onClick={() => setForm({ ...form, categoryId: x.id })} className={cx('h-14 border text-left px-3', cat?.id === x.id ? 'border-ink border-2' : 'border-line-2 hover:border-ink')}>
                    <div className="text-[14px] font-semibold">{x.name}</div>
                    <div className="text-[11.5px] text-mute">{x.en}</div>
                  </button>
                ))}
              </div>
            </Field>
            <Field label="판매 예정 상품" req hint="대표 상품 2~10개. 상품명 · 세부 분류 · 예상 판매가">
              <div className="space-y-2">
                {products.map((p, i) => (
                  <div key={i} className="grid grid-cols-[1fr_120px_140px] gap-2">
                    <input className="field" placeholder={`상품명 ${i + 1}`} value={p.name} onChange={(e) => setProduct(i, 'name', e.target.value)} />
                    <select className="field" value={p.subCategory || cat?.subs[0] || ''} onChange={(e) => setProduct(i, 'subCategory', e.target.value)} aria-label={`세부 분류 ${i + 1}`}>{(cat?.subs ?? []).map((s) => <option key={s}>{s}</option>)}</select>
                    <input className="field num" type="number" min="1" placeholder="예상 판매가" value={p.price} onChange={(e) => setProduct(i, 'price', e.target.value)} />
                  </div>
                ))}
                {products.length < 10 && <button type="button" onClick={() => setProducts([...products, { name: '', subCategory: '', price: '' }])} className="btn btn-ghost btn-sm">+ 상품 추가</button>}
              </div>
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="월 예상 매출"><select className="field" value={form.expectedMonthlySales} onChange={set('expectedMonthlySales')}>{EXPECTED_SALES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
              <Field label="운영 중인 채널"><input className="field" placeholder="자사몰, 인스타그램 등 URL" value={form.salesChannel} onChange={set('salesChannel')} /></Field>
            </div>
            <Field label="스토어 소개"><textarea rows={4} className="field" placeholder="어떤 가게인지, 어떤 상품을 만드는지 소개해주세요." value={form.intro} onChange={set('intro')} /></Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <h2 className="text-[20px] font-bold mb-2">서류 제출</h2>
            <p className="text-[13px] text-mute mb-4">PDF, JPG, PNG (최대 10MB) · 발급일 3개월 이내 · 상품 사진은 JPG, PNG</p>
            {DOC_TYPES.map((t) => (
              <Doc key={t.value} type={t} files={docs[t.value]}
                onPick={(f) => setDocs({ ...docs, [t.value]: t.multiple ? [...docs.PRODUCT_PHOTO, ...f].slice(0, PRODUCT_PHOTO_MAX) : f })}
                onClear={() => setDocs({ ...docs, [t.value]: t.multiple ? [] : null })} />
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-[20px] font-bold">정산 계좌 · 약관</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              <Field label="은행" req><select className="field" value={form.bank} onChange={set('bank')}>{BANKS.map((b) => <option key={b}>{b}</option>)}</select></Field>
              <Field label="계좌번호" req><input className="field num" value={form.number} onChange={set('number')} /></Field>
              <Field label="예금주" req><input className="field" value={form.holder} onChange={set('holder')} /></Field>
            </div>
            <div className="border border-line">
              <div className="px-4 h-11 flex items-center bg-cream font-semibold text-[14px] border-b border-line">정산 정책 요약</div>
              <table className="w-full text-[13px]">
                <tbody>
                  {[['판매수수료', '상위 카테고리별 요율 (첫 3개월 50%)'], ['결제수수료', '2.2% (PG사 수수료)'], ['정산 기준', '구매확정일 (배송완료 7일 후 자동 확정)'], ['정산 주기', '주 1회 · 월~일 확정분을 다음 주 목요일 지급'], ['지급 보류', '클레임 미처리, 스토어 정지 시 해당 건 지급 보류']].map(([k, v]) => (
                    <tr key={k} className="border-b border-line last:border-0"><th className="w-28 text-left font-medium text-ink-2 px-4 py-2.5">{k}</th><td className="px-4 py-2.5">{v}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 text-[13px]">
              {[['sellerTerms', '(필수) 곳간 판매자 이용약관'], ['electronicFinance', '(필수) 전자금융거래 이용약관'], ['privacy', '(필수) 개인정보 수집 및 이용 동의'], ['marketing', '(선택) 판매자 마케팅 소식 수신']].map(([k, t]) => (
                <Checkbox key={k} checked={agree[k]} onChange={(v) => setAgree({ ...agree, [k]: v })} label={t} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 pt-5 border-t border-line flex justify-between">
          <button type="button" disabled={step === 0 || apply.isPending} onClick={() => setStep(step - 1)} className="btn btn-line">이전</button>
          {step < 3 ? (
            <button type="button" onClick={next} className="btn btn-ink px-8">다음 단계</button>
          ) : (
            <button type="button" disabled={apply.isPending} onClick={submit} className="btn btn-point px-8">{apply.isPending ? '제출 중…' : '입점 신청하기'}</button>
          )}
        </div>
      </div>
    </div>
  );
}
