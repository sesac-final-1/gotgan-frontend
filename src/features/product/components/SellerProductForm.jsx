// 판매자 상품 등록 / 수정 — 담당 박지연
import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { X, GripVertical, ImagePlus } from 'lucide-react';
import { PageHead, Segments, Checkbox, Price } from '@/shared/components/ui';
import { useProductsQuery } from '@/features/product/hooks/useProductsQuery';
import { useCategoriesQuery } from '@/features/product/hooks/useCategoriesQuery';
import { useMyStoreQuery } from '@/features/store/hooks/useMyStoreQuery';
import { PAYMENT_FEE } from '@/features/settlement/constants';
import { toast } from '@/shared/stores/toastStore';
import { toMap } from '@/shared/utils/collection';
import { won, pct } from '@/shared/utils/format';

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

// /seller/products/new · /seller/products/:id/edit — 데이터가 모두 온 뒤 폼을 그린다 (초기값이 훅 데이터라서)
export default function SellerProductForm() {
  const { id } = useParams();
  const { data: products = [], isLoading: pLoading } = useProductsQuery();
  const { data: categories = [], isLoading: cLoading } = useCategoriesQuery();
  const { data: store, isLoading: sLoading } = useMyStoreQuery();
  if (pLoading || cLoading || sLoading) return <p className="text-mute py-10 text-center">불러오는 중…</p>;
  const src = id ? products.find((p) => p.id === id) : null;
  if ((id && !src) || !store || !categories.length) return <p className="text-mute py-10 text-center">상품을 찾을 수 없어요</p>;
  return <FormBody key={id ?? 'new'} src={src} categories={categories} store={store} />; // key: 다른 상품으로 이동하면 폼 초기화
}

function FormBody({ src, categories, store }) {
  const edit = !!src;
  const nav = useNavigate();
  const catById = useMemo(() => toMap(categories), [categories]);
  const [name, setName] = useState(src?.name || '');
  const [cat, setCat] = useState(src?.cat || store.cat);
  const [sub, setSub] = useState(src?.sub || catById[store.cat]?.subs[0]);
  const [price, setPrice] = useState(src?.price || 0);
  const [disc, setDisc] = useState(src ? Math.round(src.discount * 100) : 0);
  const [opts, setOpts] = useState(src?.options.length ? src.options.map((o) => ({ name: o.name, values: o.values.join(', ') })) : [{ name: '컬러', values: '' }]);
  const [imgs, setImgs] = useState(src?.images || []);
  const [status, setStatus] = useState(src?.status || '판매중');
  const [shipMode, setShipMode] = useState('store');

  const combos = useMemo(() => {
    const lists = opts.filter((o) => o.name && o.values.trim()).map((o) => o.values.split(',').map((v) => v.trim()).filter(Boolean));
    if (!lists.length) return [];
    return lists.reduce((acc, l) => acc.flatMap((a) => l.map((v) => [...a, v])), [[]]);
  }, [opts]);
  const c = catById[cat];
  const sp = Math.round((price * (1 - disc / 100)) / 10) * 10;
  const fee = Math.round(sp * (c.commission + PAYMENT_FEE));
  // TODO(박지연): useCreateProductMutation / useUpdateProductMutation
  const submit = () => { toast(edit ? '상품이 수정되었어요' : '상품이 등록되었어요'); nav('/seller/products'); };

  return (
    <div>
      <PageHead crumbs="상품 > 상품 조회/수정" title={edit ? '상품 수정' : '상품 등록'} desc={edit ? `${src.id.toUpperCase()} · 최근 수정 2026.09.28 14:02` : '필수 항목(*)을 모두 입력하면 바로 판매가 시작됩니다.'} />
      <div className="grid xl:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-4 min-w-0">
          <Block title="카테고리 · 상품명">
            <Row label="카테고리" req>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[11.5px] text-mute mb-1">상위 카테고리</div>
                  <select value={cat} onChange={(e) => { setCat(e.target.value); setSub(catById[e.target.value].subs[0]); }} className="field">{categories.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
                </div>
                <div>
                  <div className="text-[11.5px] text-mute mb-1">하위 카테고리</div>
                  <select value={sub} onChange={(e) => setSub(e.target.value)} className="field">{c.subs.map((s) => <option key={s}>{s}</option>)}</select>
                </div>
              </div>
              <p className="text-[12px] text-mute mt-1.5"><span className="text-ink">{c.name} &gt; {sub}</span> · 판매수수료 {pct(c.commission)} + 결제수수료 2.2% · 카테고리는 운영자가 등록한 목록에서만 선택할 수 있어요 {cat !== store.cat && <span className="text-amber">· 입점 카테고리 외 등록은 관리자 승인 후 노출</span>}</p>
            </Row>
            <Row label="상품명" req>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} className="field" placeholder="브랜드명 · 핵심 소재 · 상품 종류 순으로 작성하면 검색에 유리해요" />
              <div className="text-right text-[11.5px] text-mute mt-1 num">{name.length}/50</div>
            </Row>
          </Block>

          <Block title="판매가 · 재고">
            <Row label="판매가" req><div className="flex items-center gap-2"><input value={price || ''} onChange={(e) => setPrice(Number(e.target.value.replace(/\D/g, '')))} className="field num w-48" /><span className="text-sm">원</span></div></Row>
            <Row label="즉시할인">
              <div className="flex items-center gap-2"><input value={disc || ''} onChange={(e) => setDisc(Math.min(90, Number(e.target.value.replace(/\D/g, ''))))} className="field num w-24" /><span className="text-sm">%</span>
                {disc > 0 && <span className="text-[13px] text-ink-2 ml-2">할인가 <b className="num">{won(sp)}</b></span>}
              </div>
            </Row>
            <Row label="예상 정산액">
              <div className="bg-cream px-4 py-3 text-[13px] num">
                {won(sp)} − 수수료 {won(fee)} = <b className="text-[15px]">{won(sp - fee)}</b> <span className="text-mute font-sans">/ 1개당</span>
              </div>
            </Row>
          </Block>

          <Block title="옵션" desc="조합형 옵션: 옵션값은 쉼표(,)로 구분하세요. 조합별로 재고와 추가금액을 설정할 수 있어요.">
            {opts.map((o, i) => (
              <div key={i} className="grid grid-cols-[120px_1fr_36px] gap-2">
                <input value={o.name} onChange={(e) => setOpts(opts.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} className="field" placeholder="옵션명" />
                <input value={o.values} onChange={(e) => setOpts(opts.map((x, k) => (k === i ? { ...x, values: e.target.value } : x)))} className="field" placeholder="예) S, M, L" />
                <button onClick={() => setOpts(opts.filter((_, k) => k !== i))} className="btn btn-ghost px-0"><X size={16} /></button>
              </div>
            ))}
            {opts.length < 3 && <button onClick={() => setOpts([...opts, { name: '', values: '' }])} className="btn btn-line btn-sm">+ 옵션 추가 (최대 3개)</button>}
            {/* 옵션 조합 입력표 — 목록이 아니라 입력 폼이라 DataTable 대신 목업 <table> 그대로 */}
            {combos.length > 0 && (
              <div className="border border-line overflow-x-auto">
                <table className="tbl">
                  <thead><tr><th>옵션 조합</th><th className="w-32">추가금액</th><th className="w-28">재고</th><th className="w-24">판매</th></tr></thead>
                  <tbody>
                    {combos.slice(0, 12).map((cb, i) => (
                      <tr key={cb.join()}>
                        <td>{cb.join(' / ')}</td>
                        <td><input className="field field-sm num" defaultValue="0" /></td>
                        <td><input className="field field-sm num" defaultValue={src ? Math.max(0, Math.round(src.stock / combos.length) - (i % 3) * 4) : 0} /></td>
                        <td><Checkbox checked onChange={() => {}} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {combos.length > 12 && <div className="text-[12px] text-mute px-3 py-2">외 {combos.length - 12}개 조합</div>}
              </div>
            )}
          </Block>

          <Block title="상품 이미지" desc="대표 이미지 1장 + 추가 이미지 최대 9장 · 1000×1250px 이상 권장 · 첫 번째 이미지가 대표 이미지">
            <div className="flex flex-wrap gap-2">
              {imgs.map((s, i) => (
                <div key={s} className="relative w-24 h-28 group">
                  <img src={s} alt="" className="w-full h-full object-cover" />
                  {i === 0 && <span className="absolute left-0 top-0 bg-ink text-white text-[10px] px-1.5 py-0.5">대표</span>}
                  <span className="absolute left-1 bottom-1 bg-white/90 p-0.5 cursor-grab"><GripVertical size={12} /></span>
                  <button onClick={() => setImgs(imgs.filter((x) => x !== s))} className="absolute right-1 top-1 bg-white/90 p-0.5"><X size={12} /></button>
                </div>
              ))}
              <button onClick={() => setImgs([...imgs, `/images/p/p104-${(imgs.length % 3) + 1}.jpg`])} className="w-24 h-28 border border-dashed border-line-2 text-mute text-[12px] flex flex-col items-center justify-center gap-1 hover:border-ink hover:text-ink"><ImagePlus size={20} />추가</button>
            </div>
          </Block>

          <Block title="상세 설명">
            <div className="border border-line-2">
              <div className="flex gap-1 px-2 h-10 items-center border-b border-line bg-cream text-[13px] overflow-x-auto no-scrollbar">
                {['B', 'I', 'U', 'H1', 'H2', '이미지', '동영상', '표', '구분선'].map((t) => <button key={t} className="px-2 h-7 hover:bg-white">{t}</button>)}
              </div>
              <div className="p-4 min-h-[160px] text-[14px] text-ink-2 leading-relaxed" contentEditable suppressContentEditableWarning>
                {edit ? <>{store.intro}<br /><br />소재: {src.material}<br />세탁: 찬물 단독 손세탁 / 건조기 사용 금지</> : <span className="text-mute">상품의 특징, 사이즈 가이드, 세탁 방법 등을 작성하세요.</span>}
              </div>
            </div>
          </Block>

          <Block title="상품정보 제공고시" desc="전자상거래법에 따라 카테고리별 필수 항목을 입력해야 합니다.">
            {['소재', '제조국', '제조자/수입자', '세탁방법 및 취급 주의사항', '품질보증기준'].map((k, i) => (
              <Row key={k} label={k} req><input className="field" defaultValue={edit ? [src.material, src.origin, store.name, '찬물 단독 손세탁', '소비자분쟁해결기준에 따름'][i] : ''} /></Row>
            ))}
          </Block>

          <Block title="배송">
            <Row label="배송비 설정">
              <div className="space-y-2 text-[13px]">
                <label className="flex items-center gap-2"><input type="radio" checked={shipMode === 'store'} onChange={() => setShipMode('store')} /> 스토어 기본 정책 사용 — {store.courier} · {won(store.shipFee)} ({won(store.freeOver)} 이상 무료)</label>
                <label className="flex items-center gap-2"><input type="radio" checked={shipMode === 'custom'} onChange={() => setShipMode('custom')} /> 상품별 개별 설정</label>
                {shipMode === 'custom' && <div className="grid grid-cols-3 gap-2 pl-6"><select className="field field-sm"><option>유료</option><option>무료</option><option>조건부 무료</option></select><input className="field field-sm" placeholder="배송비" /><input className="field field-sm" placeholder="무료 기준 금액" /></div>}
              </div>
            </Row>
            <Row label="출고 소요일"><select className="field w-60"><option>당일 출고 (14시 이전 결제)</option><option>1~2 영업일</option><option>3~5 영업일 (주문제작)</option></select></Row>
          </Block>
        </div>

        {/* 사이드 */}
        <div className="space-y-4 xl:sticky xl:top-20 self-start">
          <div className="panel">
            <div className="panel-head"><span className="panel-title">미리보기</span></div>
            <div className="p-5">
              <div className="aspect-[4/5] bg-sand">{imgs[0] && <img src={imgs[0]} alt="" className="w-full h-full object-cover" />}</div>
              <div className="text-[12px] font-bold text-ink-2 mt-2.5">{store.name}</div>
              <div className="text-[13px] text-ink-2">{name || '상품명을 입력하세요'}</div>
              <div className="mt-1"><Price p={{ price: price || 0, discount: disc / 100 }} /></div>
            </div>
          </div>
          <div className="panel p-5 space-y-3">
            <div className="text-[13px] font-semibold">판매 상태</div>
            <Segments items={['판매중', '판매중지']} value={status === '품절' ? '판매중' : status} onChange={setStatus} />
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button onClick={() => nav('/seller/products')} className="btn btn-line">취소</button>
              <button onClick={submit} className="btn btn-ink">{edit ? '수정 저장' : '등록하기'}</button>
            </div>
            {edit && <button className="btn btn-ghost btn-sm w-full text-rust">상품 삭제</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
