// 보완 재제출 — 담당 박지연. 계약: backend docs/api/store.md 2-3절(PATCH /api/seller/apply/{id}/resubmit) · 2-2절 submitted
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCategoriesQuery } from '@/features/product/hooks/useCategoriesQuery';
import { useResubmitApplicationMutation } from '@/features/store/hooks/useResubmitApplicationMutation';
import { buildResubmitRequest, formatProblem, requiredDocTypes, toResubmitForm } from '@/features/store/applyRules';
import { BANKS, BIZ_TYPES, DOC_TYPES, EXPECTED_SALES, PRODUCT_PHOTO_MAX, PRODUCT_PHOTO_MIN } from '@/features/store/constants';
import { Doc, Field } from '@/features/store/components/ApplyFormParts';
import { queryKeys } from '@/shared/api/queryKeys';
import { PostcodeSearch } from '@/shared/components/common/PostcodeSearch';
import { toast } from '@/shared/stores/toastStore';
import { cx, ymd } from '@/shared/utils/format';

/* 제출한 내용(me.submitted)으로 채운 한 페이지 폼 — 틀린 칸만 고치면 바뀐 칸만 보낸다(buildResubmitRequest).
   다시 낼 서류 = 보완요청 서류 전부 + 사업자 정보를 바꿨으면 사업자등록증. 서류가 아닌 내용 보완이면 고친 칸만, 아무것도 안 바꿔도 "확인"으로 접수 */
const REQUIRED = ['companyName', 'ownerName', 'bizRegNo', 'ecommerceRegNo', 'managerPhone', 'managerEmail', 'businessAddress', 'storeName', 'slug', 'bank', 'number', 'holder'];
const FORMAT_FIELDS = ['bizRegNo', 'managerPhone', 'managerEmail', 'slug'];

export default function ShopSellerResubmit({ me, onCancel }) {
  const qc = useQueryClient();
  const { data: categories = [] } = useCategoriesQuery();
  const resubmit = useResubmitApplicationMutation();
  const [form, setForm] = useState(() => toResubmitForm(me));
  const [docs, setDocs] = useState({ BUSINESS_REG: null, ECOMMERCE_REG: null, BANK_COPY: null, PRODUCT_PHOTO: [] });
  const [postcode, setPostcode] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setProduct = (i, k, v) => setForm({ ...form, products: form.products.map((p, j) => (j === i ? { ...p, [k]: v } : p)) });
  const cat = categories.find((x) => x.id === form.categoryId) ?? categories[0];

  const { request, bizChanged } = buildResubmitRequest(me, form);
  const needDocs = DOC_TYPES.filter((t) => requiredDocTypes(me, bizChanged).includes(t.value));
  const currentFiles = (type) => me.submitted.documents.filter((d) => d.docType === type).map((d) => d.originalName).join(', ');
  const changedCount = Object.keys(request).length + needDocs.length;

  // 화면 검사 — 신청 폼과 같은 수준(빈칸 · 형식 4칸 · 상품 · 서류 개수). 나머지는 서버 400 메시지로
  const problem = () => {
    if (REQUIRED.some((k) => !String(form[k]).trim())) return '필수 항목을 비울 수 없어요';
    const bad = formatProblem(FORMAT_FIELDS, form);
    if (bad) return bad;
    if (form.products.length < 2 || form.products.some((p) => !p.name.trim() || !(Number(p.price) > 0))) return '판매 예정 상품을 2개 이상, 상품명과 판매가까지 입력해 주세요';
    for (const t of needDocs) {
      const files = docs[t.value];
      if (t.multiple ? files.length < PRODUCT_PHOTO_MIN || files.length > PRODUCT_PHOTO_MAX : !files) {
        return t.multiple ? `${t.label}을 ${PRODUCT_PHOTO_MIN}~${PRODUCT_PHOTO_MAX}장 다시 올려 주세요` : `${t.label}을 다시 올려 주세요`;
      }
    }
    return null;
  };

  const submit = () => {
    const p = problem();
    if (p) { toast(p); return; }
    resubmit.mutate({
      applicationId: me.applicationId,
      request,
      docs: needDocs.flatMap((t) => (t.multiple ? docs[t.value].map((file) => ({ docType: t.value, file })) : [{ docType: t.value, file: docs[t.value] }])),
    }, {
      onSuccess: () => { toast('보완 내용을 제출했어요. 다시 심사해 드릴게요.'); window.scrollTo(0, 0); }, // me 가 다시 조회되며 "심사대기" 화면으로
      onError: (e) => {
        toast(e.response?.data?.message ?? e.message ?? '제출하지 못했어요. 잠시 후 다시 시도해 주세요.');
        if (e.response?.data?.code === 'APPLY_INVALID_STATUS') void qc.invalidateQueries({ queryKey: queryKeys.store.myApplication() }); // 기한 지남 · 이미 처리됨 → 상태 화면
      },
    });
  };

  const banks = BANKS.includes(form.bank) ? BANKS : [form.bank, ...BANKS]; // 신청 때 고른 은행이 목록에 없을 수도
  return (
    <div className="max-w-[760px] mx-auto px-4 pt-10">
      <div className="eyebrow">Supplement</div>
      <h1 className="mt-2 text-[28px] font-bold tracking-tight">보완 제출</h1>
      <p className="mt-2 text-ink-2 text-sm">접수번호 <b className="num">{me.applicationNo}</b> · {me.supplementDueAt ? `${ymd(me.supplementDueAt)}까지` : ''} 제출해 주세요. 제출한 내용이 채워져 있어요 — 틀린 칸만 고치면 돼요.</p>
      <div className="mt-6 bg-cream p-5 text-[13px] leading-relaxed">
        <b>보완 요청</b>
        <p className="mt-1 text-ink-2">{me.statusReason}</p>
      </div>

      <section className="mt-10 space-y-3">
        <h2 className="text-[18px] font-bold">다시 낼 서류</h2>
        {needDocs.length === 0
          ? <p className="text-[13px] text-mute">다시 낼 서류는 없어요. 아래에서 고칠 내용만 수정해 주세요.</p>
          : <p className="text-[13px] text-mute">PDF, JPG, PNG (최대 10MB) · 상품 사진은 JPG, PNG{bizChanged && ' · 사업자 정보를 바꿔 사업자등록증도 다시 내야 해요'}</p>}
        {needDocs.map((t) => (
          <Doc key={t.value} type={t} files={docs[t.value]} current={currentFiles(t.value)}
            onPick={(f) => setDocs({ ...docs, [t.value]: t.multiple ? [...docs.PRODUCT_PHOTO, ...f].slice(0, PRODUCT_PHOTO_MAX) : f })}
            onClear={() => setDocs({ ...docs, [t.value]: t.multiple ? [] : null })} />
        ))}
      </section>

      <section className="mt-10 space-y-5">
        <h2 className="text-[18px] font-bold">판매자 정보</h2>
        <Field label="사업자 구분" req hint="사업자 구분 · 대표자명 · 사업자등록번호를 바꾸면 사업자등록증도 다시 내야 해요.">
          <div className="grid grid-cols-2 gap-2">
            {BIZ_TYPES.map((t) => <button key={t.value} type="button" onClick={() => setForm({ ...form, bizType: t.value })} className={cx('h-11 border text-sm', form.bizType === t.value ? 'border-ink border-2 font-bold' : 'border-line-2')}>{t.label}</button>)}
          </div>
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="상호명" req><input className="field" value={form.companyName} onChange={set('companyName')} /></Field>
          <Field label="대표자명" req><input className="field" value={form.ownerName} onChange={set('ownerName')} /></Field>
          <Field label="사업자등록번호" req><input className="field num" placeholder="000-00-00000" value={form.bizRegNo} onChange={set('bizRegNo')} /></Field>
          <Field label="통신판매업 신고번호" req><input className="field num" value={form.ecommerceRegNo} onChange={set('ecommerceRegNo')} /></Field>
          <Field label="담당자 휴대폰" req><input className="field num" placeholder="010-0000-0000" value={form.managerPhone} onChange={set('managerPhone')} /></Field>
          <Field label="담당자 이메일" req><input className="field" type="email" value={form.managerEmail} onChange={set('managerEmail')} /></Field>
        </div>
        <Field label="사업장 주소" req>
          <div className="flex gap-2"><input className="field" value={form.businessAddress} onChange={set('businessAddress')} /><button type="button" onClick={() => setPostcode(true)} className="btn btn-line shrink-0">검색</button></div>
          {postcode && <div className="mt-2"><PostcodeSearch onSelect={({ addr }) => { setForm({ ...form, businessAddress: addr }); setPostcode(false); }} /></div>}
        </Field>
      </section>

      <section className="mt-10 space-y-5">
        <h2 className="text-[18px] font-bold">스토어 · 상품</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="스토어 이름" req><input className="field" value={form.storeName} onChange={set('storeName')} /></Field>
          <Field label="스토어 주소" req hint="영소문자 · 숫자 · 하이픈 3~30자"><input className="field" value={form.slug} onChange={set('slug')} aria-label="스토어 주소" /></Field>
        </div>
        <Field label="대표 카테고리" req>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {categories.map((x) => (
              <button key={x.id} type="button" onClick={() => setForm({ ...form, categoryId: x.id })} className={cx('h-12 border text-left px-3 text-[14px]', cat?.id === x.id ? 'border-ink border-2 font-semibold' : 'border-line-2 hover:border-ink')}>{x.name}</button>
            ))}
          </div>
        </Field>
        <Field label="판매 예정 상품" req hint="대표 상품 2~10개">
          <div className="space-y-2">
            {form.products.map((p, i) => (
              <div key={i} className="grid grid-cols-[1fr_120px_140px] gap-2">
                <input className="field" placeholder={`상품명 ${i + 1}`} value={p.name} onChange={(e) => setProduct(i, 'name', e.target.value)} />
                <select className="field" value={p.subCategory} onChange={(e) => setProduct(i, 'subCategory', e.target.value)} aria-label={`세부 분류 ${i + 1}`}>
                  {[...new Set([p.subCategory, ...(cat?.subs ?? [])])].filter(Boolean).map((s) => <option key={s}>{s}</option>)}
                </select>
                <input className="field num" type="number" min="1" placeholder="예상 판매가" value={p.price} onChange={(e) => setProduct(i, 'price', e.target.value)} />
              </div>
            ))}
            {form.products.length < 10 && <button type="button" onClick={() => setForm({ ...form, products: [...form.products, { name: '', subCategory: cat?.subs[0] ?? '', price: '' }] })} className="btn btn-ghost btn-sm">+ 상품 추가</button>}
          </div>
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="월 예상 매출"><select className="field" value={form.expectedMonthlySales} onChange={set('expectedMonthlySales')}>{EXPECTED_SALES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
          <Field label="운영 중인 채널"><input className="field" value={form.salesChannel} onChange={set('salesChannel')} /></Field>
        </div>
        <Field label="스토어 소개"><textarea rows={4} className="field" value={form.intro} onChange={set('intro')} /></Field>
      </section>

      <section className="mt-10 space-y-5">
        <h2 className="text-[18px] font-bold">정산 계좌</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="은행" req><select className="field" value={form.bank} onChange={set('bank')}>{banks.map((b) => <option key={b}>{b}</option>)}</select></Field>
          <Field label="계좌번호" req><input className="field num" value={form.number} onChange={set('number')} /></Field>
          <Field label="예금주" req><input className="field" value={form.holder} onChange={set('holder')} /></Field>
        </div>
      </section>

      <div className="mt-10 pt-5 border-t border-line flex items-center justify-between gap-3">
        <button type="button" disabled={resubmit.isPending} onClick={onCancel} className="btn btn-line">취소</button>
        <span className="text-[13px] text-mute">{changedCount ? `고친 항목 ${changedCount}개` : '고친 항목 없음 — 확인만 제출돼요'}</span>
        <button type="button" disabled={resubmit.isPending} onClick={submit} className="btn btn-point px-8">{resubmit.isPending ? '제출 중…' : '보완 제출하기'}</button>
      </div>
    </div>
  );
}
