// 판매자 상품 등록 / 수정 — 담당 박지연. 계약 backend docs/api/product.md 12 · 13 · 16 · 17절
import { useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { X, ImagePlus } from 'lucide-react';
import { PageHead, Segments, Checkbox, Price, StatusPill } from '@/shared/components/ui';
import { useCategoriesQuery } from '@/features/product/hooks/useCategoriesQuery';
import { useSellerProductQuery } from '@/features/product/hooks/useSellerProductQuery';
import { useSaveSellerProductMutation, useDeleteSellerProductsMutation } from '@/features/product/hooks/useSellerProductMutations';
import { uploadProductImages, PRODUCT_IMAGE_TYPES, PRODUCT_IMAGE_MAX_BYTES } from '@/features/product/api/productApi';
import { initialForm, combos, rowOf, comboKey, validateForm, buildProductRequest, allStockZero, MAX_OPTION_GROUPS, MAX_IMAGES } from '@/features/product/productForm';
import { useMyStoreQuery } from '@/features/store/hooks/useMyStoreQuery';
import { toast } from '@/shared/stores/toastStore';
import { toMap } from '@/shared/utils/collection';
import { won } from '@/shared/utils/format';

function Block({ title, desc, children }) {
  return (
    <section className="panel">
      <div className="px-5 py-3.5 border-b border-line"><h2 className="panel-title">{title}</h2>{desc && <p className="text-[12px] text-mute mt-0.5">{desc}</p>}</div>
      <div className="p-5 space-y-4">{children}</div>
    </section>
  );
}
function Row({ label, req, children }) {
  return (
    <div className="grid md:grid-cols-[140px_1fr] gap-2 md:gap-4 items-start">
      <div className="text-[13px] font-semibold text-ink-2 md:pt-2.5">{label}{req && <span className="text-point">*</span>}</div>
      <div>{children}</div>
    </div>
  );
}

const digits = (v) => Number(v.replace(/\D/g, ''));
const errorMessage = (err, fallback) => err?.response?.data?.message ?? err?.message ?? fallback;

// /seller/products/new · /seller/products/:id/edit — 데이터가 모두 온 뒤 폼을 그린다 (초기값이 훅 데이터라서)
export default function SellerProductForm() {
  const { id } = useParams();
  const { data: src, isLoading: pLoading, isError } = useSellerProductQuery(id);
  const { data: categories = [], isLoading: cLoading } = useCategoriesQuery();
  const { data: store } = useMyStoreQuery();
  if ((id && pLoading) || cLoading) return <p className="text-mute py-10 text-center">불러오는 중…</p>;
  if ((id && (isError || !src)) || !categories.length) return <p className="text-mute py-10 text-center">상품을 찾을 수 없어요</p>;
  return <FormBody key={id ?? 'new'} src={id ? src : null} categories={categories} storeName={store?.name ?? ''} />; // key: 다른 상품으로 이동하면 폼 초기화
}

function FormBody({ src, categories, storeName }) {
  const edit = !!src;
  const nav = useNavigate();
  const fileRef = useRef(null);
  const catById = useMemo(() => toMap(categories), [categories]);
  const [f, setF] = useState(() => initialForm(src, categories));
  const [uploading, setUploading] = useState(false);
  const save = useSaveSellerProductMutation();
  const remove = useDeleteSellerProductsMutation();
  const set = (patch) => setF((prev) => ({ ...prev, ...patch }));

  const top = catById[f.cat];
  const list = useMemo(() => combos(f.groups), [f.groups]);
  const hasOptions = list[0].length > 0;
  const sp = Math.round((f.price * (1 - f.discountRate / 100)) / 10) * 10;
  const setGroup = (i, patch) => set({ groups: f.groups.map((g, k) => (k === i ? { ...g, ...patch } : g)) });
  const setRow = (values, patch) => set({ rows: { ...f.rows, [comboKey(values)]: { ...rowOf(f.rows, values), ...patch } } });

  // 파일 선택 → 화면 검사(개수 · 형식 · 10MB) → 발급 · S3 PUT → 키를 폼에. 미리보기는 브라우저 메모리 주소
  const addImages = async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    if (f.images.length + files.length > MAX_IMAGES) return toast(`이미지는 ${MAX_IMAGES}장까지 올릴 수 있어요`);
    if (files.some((x) => !PRODUCT_IMAGE_TYPES.includes(x.type))) return toast('JPG · PNG · WEBP 이미지만 올릴 수 있어요');
    if (files.some((x) => x.size > PRODUCT_IMAGE_MAX_BYTES)) return toast('이미지는 한 장에 10MB 이하만 올릴 수 있어요');
    setUploading(true);
    try {
      const keys = await uploadProductImages(files);
      setF((prev) => ({ ...prev, images: [...prev.images, ...keys.map((key, i) => ({ key, url: URL.createObjectURL(files[i]) }))] }));
    } catch (err) {
      toast(errorMessage(err, '이미지를 올리지 못했어요'));
    } finally {
      setUploading(false);
    }
  };

  const submit = () => {
    const problem = validateForm(f);
    if (problem) return toast(problem);
    if (!edit && allStockZero(f) && !window.confirm('재고가 0이라 등록하자마자 품절로 보여요. 그래도 등록할까요?')) return;
    save.mutate({ productId: src?.id, request: buildProductRequest(f) }, {
      onSuccess: () => { toast(edit ? '상품이 수정되었어요' : '상품이 등록되었어요'); void nav('/seller/products'); },
      onError: (err) => toast(errorMessage(err, '저장하지 못했어요. 잠시 후 다시 시도해 주세요.')),
    });
  };
  const del = () => {
    if (!window.confirm('이 상품을 삭제할까요? 지난 주문과 리뷰는 그대로 남아요.')) return;
    remove.mutate([src.id], {
      onSuccess: ({ failed }) => { if (failed.length) return toast(failed[0].message); toast('상품을 삭제했어요'); void nav('/seller/products'); },
      onError: (err) => toast(errorMessage(err, '삭제하지 못했어요')),
    });
  };
  const busy = save.isPending || remove.isPending || uploading;

  return (
    <div>
      <PageHead crumbs="상품 > 상품 조회/수정" title={edit ? '상품 수정' : '상품 등록'} desc={edit ? `상품번호 ${src.id}` : '필수 항목(*)을 모두 입력하면 바로 판매가 시작됩니다.'} />
      <div className="grid xl:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-4 min-w-0">
          <Block title="카테고리 · 상품명">
            <Row label="카테고리" req>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[11.5px] text-mute mb-1">상위 카테고리</div>
                  <select value={f.cat ?? ''} onChange={(e) => { const t = catById[e.target.value]; set({ cat: t.id, catId: t.children[0]?.id }); }} className="field">
                    {!top && <option value="" disabled>선택</option>}
                    {categories.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                </div>
                <div>
                  <div className="text-[11.5px] text-mute mb-1">하위 카테고리</div>
                  <select value={f.catId ?? ''} onChange={(e) => set({ catId: Number(e.target.value) })} className="field">
                    {!top?.children.some((s) => s.id === f.catId) && <option value="" disabled>선택</option>}
                    {(top?.children ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <p className="text-[12px] text-mute mt-1.5">카테고리는 운영자가 등록한 목록에서만 선택할 수 있어요 · 판매수수료는 카테고리별로 정산 때 적용돼요</p>
            </Row>
            <Row label="상품명" req>
              <input value={f.name} onChange={(e) => set({ name: e.target.value })} maxLength={100} className="field" placeholder="브랜드명 · 핵심 소재 · 상품 종류 순으로 작성하면 검색에 유리해요" />
              <div className="text-right text-[11.5px] text-mute mt-1 num">{f.name.length}/100</div>
            </Row>
          </Block>

          <Block title="판매가">
            <Row label="판매가" req><div className="flex items-center gap-2"><input value={f.price || ''} onChange={(e) => set({ price: digits(e.target.value) })} className="field num w-48" /><span className="text-sm">원</span></div></Row>
            <Row label="즉시할인">
              <div className="flex items-center gap-2"><input value={f.discountRate || ''} onChange={(e) => set({ discountRate: Math.min(90, digits(e.target.value)) })} className="field num w-24" /><span className="text-sm">%</span>
                {f.discountRate > 0 && <span className="text-[13px] text-ink-2 ml-2">할인가 <b className="num">{won(sp)}</b></span>}
              </div>
            </Row>
          </Block>

          <Block title="옵션 · 재고" desc="옵션은 최대 2개, 옵션값은 쉼표(,)로 구분하세요. 옵션이 없으면 비워 두고 재고만 입력하세요.">
            {f.groups.map((g, i) => (
              <div key={i} className="grid grid-cols-[120px_1fr_36px] gap-2">
                <input value={g.name} onChange={(e) => setGroup(i, { name: e.target.value })} maxLength={30} className="field" placeholder="옵션명" />
                <input value={g.values} onChange={(e) => setGroup(i, { values: e.target.value })} className="field" placeholder="예) S, M, L" />
                <button onClick={() => set({ groups: f.groups.filter((_, k) => k !== i) })} className="btn btn-ghost px-0" aria-label="옵션 삭제"><X size={16} /></button>
              </div>
            ))}
            {f.groups.length < MAX_OPTION_GROUPS && <button onClick={() => set({ groups: [...f.groups, { name: '', values: '' }] })} className="btn btn-line btn-sm">+ 옵션 추가 (최대 {MAX_OPTION_GROUPS}개)</button>}
            {/* 옵션 조합 입력표 — 목록이 아니라 입력 폼이라 DataTable 대신 <table> */}
            <div className="border border-line overflow-x-auto max-h-[420px]">
              <table className="tbl">
                <thead><tr><th>옵션 조합</th><th className="w-32">추가금액</th><th className="w-28">재고<span className="text-point">*</span></th><th className="w-20">판매</th></tr></thead>
                <tbody>
                  {list.map((values) => {
                    const r = rowOf(f.rows, values);
                    const saved = edit && r.productOptionId != null; // 저장된 조합의 재고는 재고 수정(14절)에서 — 수정(PUT)은 재고를 바꾸지 않음
                    return (
                      <tr key={comboKey(values)}>
                        <td>{hasOptions ? values.join(' / ') : '옵션 없음'}</td>
                        <td><input className="field field-sm num" value={r.extraPrice} disabled={!hasOptions} onChange={(e) => setRow(values, { extraPrice: digits(e.target.value) })} /></td>
                        <td>{saved ? <span className="num text-ink-2">{r.stock}</span> : <input className="field field-sm num" value={r.stock} onChange={(e) => setRow(values, { stock: digits(e.target.value) })} />}</td>
                        <td><Checkbox checked={r.on} onChange={(on) => setRow(values, { on })} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {edit && <p className="text-[12px] text-mute">저장된 조합의 재고는 상품 목록의 재고 수정에서 바꿔요. 판매 체크를 풀면 그 조합은 삭제돼요(지난 주문은 그대로).</p>}
          </Block>

          <Block title="상품 이미지" desc={`최대 ${MAX_IMAGES}장 · JPG · PNG · WEBP · 한 장 10MB 이하 · 1000×1250px 이상 권장 · 첫 번째 이미지가 대표 이미지`}>
            <div className="flex flex-wrap gap-2">
              {f.images.map((img, i) => (
                <div key={img.key} className="relative w-24 h-28">
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                  {i === 0
                    ? <span className="absolute left-0 top-0 bg-ink text-white text-[10px] px-1.5 py-0.5">대표</span>
                    : <button onClick={() => set({ images: [img, ...f.images.filter((x) => x.key !== img.key)] })} className="absolute left-1 bottom-1 bg-white/90 text-[10px] px-1">대표로</button>}
                  <button onClick={() => set({ images: f.images.filter((x) => x.key !== img.key) })} className="absolute right-1 top-1 bg-white/90 p-0.5" aria-label="이미지 삭제"><X size={12} /></button>
                </div>
              ))}
              {f.images.length < MAX_IMAGES && (
                <button disabled={uploading} onClick={() => fileRef.current?.click()} className="w-24 h-28 border border-dashed border-line-2 text-mute text-[12px] flex flex-col items-center justify-center gap-1 hover:border-ink hover:text-ink">
                  <ImagePlus size={20} />{uploading ? '올리는 중…' : '추가'}
                </button>
              )}
              <input ref={fileRef} type="file" accept={PRODUCT_IMAGE_TYPES.join(',')} multiple hidden onChange={addImages} />
            </div>
          </Block>

          <Block title="상세 설명" desc="HTML 로 작성할 수 있어요(최대 10,000자). 스크립트 · 스타일 같은 위험한 태그는 저장할 때 지워져요.">
            <textarea value={f.description} onChange={(e) => set({ description: e.target.value })} maxLength={10000} rows={8} className="field font-mono text-[13px]" placeholder="<p>상품의 특징, 사이즈 가이드, 세탁 방법 등을 작성하세요.</p>" />
            <div className="text-right text-[11.5px] text-mute num">{f.description.length}/10,000</div>
          </Block>

          <Block title="상품정보 제공고시" desc="그 밖의 항목(제조자 · 취급 주의사항 · 품질보증기준 등)은 상세 설명에 적어 주세요.">
            <Row label="소재" req><input value={f.material} onChange={(e) => set({ material: e.target.value })} maxLength={100} className="field" /></Row>
            <Row label="제조국" req><input value={f.origin} onChange={(e) => set({ origin: e.target.value })} maxLength={50} className="field" /></Row>
          </Block>
        </div>

        {/* 사이드 */}
        <div className="space-y-4 xl:sticky xl:top-20 self-start">
          <div className="panel">
            <div className="panel-head"><span className="panel-title">미리보기</span></div>
            <div className="p-5">
              <div className="aspect-[4/5] bg-sand">{f.images[0] && <img src={f.images[0].url} alt="" className="w-full h-full object-cover" />}</div>
              <div className="text-[12px] font-bold text-ink-2 mt-2.5">{storeName}</div>
              <div className="text-[13px] text-ink-2">{f.name || '상품명을 입력하세요'}</div>
              <div className="mt-1"><Price p={{ price: f.price || 0, discount: f.discountRate / 100 }} /></div>
            </div>
          </div>
          <div className="panel p-5 space-y-3">
            <div className="text-[13px] font-semibold">판매 상태</div>
            {edit ? (
              <div className="text-[13px] space-y-1">
                <StatusPill s={src.pill} />
                {src.statusReason && <p className="text-rust text-[12px]">사유: {src.statusReason}</p>}
                <p className="text-mute text-[12px]">판매중지 · 재개는 상품 목록에서 바꿔요</p>
              </div>
            ) : <Segments items={['판매중', '판매중지']} value={f.status} onChange={(status) => set({ status })} />}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button onClick={() => nav('/seller/products')} className="btn btn-line">취소</button>
              <button disabled={busy} onClick={submit} className="btn btn-ink">{save.isPending ? '저장 중…' : edit ? '수정 저장' : '등록하기'}</button>
            </div>
            {edit && <button disabled={busy} onClick={del} className="btn btn-ghost btn-sm w-full text-rust">상품 삭제</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
