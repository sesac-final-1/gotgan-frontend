// 스토어 상세 — 담당 구지훈
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ExternalLink } from 'lucide-react';
import { PageHead, Segments, StatusPill, Modal, KV, Kpi } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/common/DataTable';
import { SearchInput } from '@/shared/components/common/SearchInput';
import { useClientTable } from '@/shared/hooks/useClientTable';
import { useAdminStoresQuery } from '@/features/admin/hooks/useAdminStoresQuery';
import { useAdminStoreListQuery } from '@/features/admin/hooks/useAdminStoreListQuery';
import { useChangeStoreStatusMutation } from '@/features/admin/hooks/useChangeStoreStatusMutation';
import { STORE_STATUS_REQUEST, productStatusLabel } from '@/features/admin/constants';
import { useAdminSettlementsQuery } from '@/features/admin/hooks/useAdminSettlementsQuery';
import { useAdminCategoriesQuery } from '@/features/admin/hooks/useAdminCategoriesQuery';
import { useAdminStoreProductsQuery } from '@/features/admin/hooks/useAdminStoreProductsQuery';
import { useBlockProductMutation } from '@/features/admin/hooks/useBlockProductMutation';
import { toast } from '@/shared/stores/toastStore';
import { won, comma, ymd, pct, shortWon } from '@/shared/utils/format';
import OpenChatButton from '@/features/chat/components/OpenChatButton';

const NUM = { thClass: 'text-right', tdClass: 'text-right num', search: false };

// 등록 상품 표 — product 판매자 상품 목록과 같은 응답(backend #110). 버튼이 대상 상품을 고르므로 함수로 만들고 컴포넌트에서 useMemo (컨벤션 4-7)
function buildProductColumns(setTarget) {
  return [
    {
      accessorKey: 'name', header: '상품',
      cell: ({ row: { original: p } }) => (
        <div className="flex items-center gap-2.5"><img src={p.imageUrl} alt="" className="w-9 h-9 object-cover bg-cream" />
          <div><div>{p.name}</div><div className="text-[11.5px] text-mute">{p.topCategoryName} · {p.categoryName}</div></div></div>
      ),
    },
    { accessorKey: 'salePrice', header: '판매가', meta: NUM, cell: ({ getValue }) => comma(getValue()) },
    { accessorKey: 'totalStock', header: '재고', meta: NUM, cell: ({ getValue }) => comma(getValue()) },
    {
      id: 'status', accessorFn: productStatusLabel, header: '상태',
      cell: ({ row: { original: p }, getValue }) => <><StatusPill s={getValue()} />{p.statusReason && <div className="text-[11.5px] text-mute mt-0.5">{p.statusReason}</div>}</>,
    },
    {
      id: 'action', header: '', enableSorting: false, meta: { search: false },
      cell: ({ row: { original: p } }) => (p.status === 'BLOCKED'
        ? <button onClick={() => setTarget({ product: p, blocked: false })} className="btn btn-ghost btn-xs">해제</button>
        : <button onClick={() => setTarget({ product: p, blocked: true })} className="btn btn-ghost btn-xs text-rust">강제중지</button>),
    },
  ];
}

const SETTLEMENT_COLUMNS = [
  { accessorKey: 'start', header: '기간', sortingFn: 'datetime', meta: { tdClass: 'num', search: false }, cell: ({ row }) => `${ymd(row.original.start)} ~ ${ymd(row.original.end).slice(5)}` },
  { accessorKey: 'gross', header: '매출', meta: NUM, cell: ({ getValue }) => comma(getValue()) },
  { id: 'fee', accessorFn: (x) => x.commission + x.pgFee, header: '수수료', meta: NUM, cell: ({ getValue }) => comma(getValue()) },
  { accessorKey: 'payout', header: '지급액', meta: { ...NUM, tdClass: 'text-right num font-semibold' }, cell: ({ getValue }) => comma(getValue()) },
  { accessorKey: 'pay', header: '지급일', sortingFn: 'datetime', meta: { tdClass: 'num', search: false }, cell: ({ getValue }) => ymd(getValue()) },
  { accessorKey: 'status', header: '상태', cell: ({ getValue }) => <StatusPill s={getValue()} /> },
];

export default function StoreDetail() {
  const { id } = useParams();
  const { data: list = [], isLoading } = useAdminStoreListQuery();
  const { data: mocks = [], isLoading: mockLoading } = useAdminStoresQuery();
  // 이름 · 대표자 · 등급 · 상태는 실제 목록(backend #172), 나머지 칸은 같은 slug 의 목업 — store 1절 확장이 나오면 상세 API 로 교체 (구지훈)
  const real = list.find((x) => x.id === id);
  const mock = real && mocks.find((x) => x.slug === real.slug);
  const s = mock && { ...mock, storeId: real.id, name: real.name, owner: real.owner, bizNo: real.bizNo, grade: real.grade, status: real.status,
    avg: real.avg, reviewCount: real.reviewCount }; // 평점 = review 스토어 평점(#160, 목록과 같은 값)
  if (isLoading || mockLoading) return <p className="text-mute py-10 text-center">불러오는 중…</p>;
  if (!s) return <p className="text-mute py-10 text-center">스토어를 찾을 수 없어요</p>;
  return <DetailBody key={s.id} s={s} />; // key: 다른 스토어로 이동하면 상태 변경 모달 상태 초기화
}

function DetailBody({ s }) {
  const [status, setStatus] = useState(s.status); // 모달에서 고른 상태 — 화면 표시는 s.status(다시 불러온 실제 값)
  const [reason, setReason] = useState('');
  const [modal, setModal] = useState(false);
  const changeStatus = useChangeStoreStatusMutation();
  const canSubmit = status !== s.status && reason.trim() !== '' && !changeStatus.isPending; // 정지 · 해제 모두 사유 필수(store 9절)
  const { data: settlements = [] } = useAdminSettlementsQuery();
  const { data: categories = [] } = useAdminCategoriesQuery();
  const { data: prods = [], isLoading: prodsLoading, isError: prodsError } = useAdminStoreProductsQuery(s.storeId);
  const [blockTarget, setBlockTarget] = useState(null); // { product, blocked } — 강제중지 · 해제 확인 모달
  const [blockReason, setBlockReason] = useState('');
  const block = useBlockProductMutation();
  const productColumns = useMemo(() => buildProductColumns(setBlockTarget), []);
  const onSale = prods.filter((p) => productStatusLabel(p) === '판매중').length;
  const ss = useMemo(() => settlements.filter((x) => x.storeId === s.id), [settlements, s.id]);
  const c = categories.find((x) => x.id === s.cat) ?? { name: s.cat, commission: 0 };

  const prodTable = useClientTable({ data: prods, columns: productColumns });
  const settleTable = useClientTable({ data: ss, columns: SETTLEMENT_COLUMNS, initialSorting: [{ id: 'start', desc: true }] });

  const closeBlock = () => { setBlockTarget(null); setBlockReason(''); };
  const handleBlockSubmit = () => {
    const { product, blocked } = blockTarget;
    block.mutate({ productId: product.productId, storeId: s.storeId, blocked, reason: blocked ? blockReason.trim() : null }, {
      onSuccess: () => {
        closeBlock();
        toast(blocked ? `${product.name} — 강제 판매중지했어요 (쇼핑몰에서 숨겨지고 판매자는 재개할 수 없어요)` : `${product.name} — 강제 판매중지를 풀었어요 (판매중지 상태 — 판매자가 점검 후 재개)`);
      },
      onError: (err) => toast(err.response?.data?.message ?? '상품 상태를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.'),
    });
  };

  const handleStatusSubmit = () => {
    changeStatus.mutate({ storeId: s.storeId, request: { status: STORE_STATUS_REQUEST[status], reason: reason.trim() } }, {
      onSuccess: () => {
        setModal(false);
        setReason('');
        toast(status === '정지' ? '스토어를 정지했어요 — 상품이 숨겨지고 정산 지급이 보류돼요' : '스토어 정지를 해제했어요');
      },
      onError: (err) => toast(err.response?.data?.message ?? '상태를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.'),
    });
  };

  return (
    <div>
      <PageHead crumbs="판매자 > 스토어 관리" title={s.name} desc={`${c.name} · ${s.owner} · 입점 ${ymd(s.since)}`}
        right={<><Link to={`/store/${s.id}`} className="btn btn-line btn-sm">쇼핑몰에서 보기 <ExternalLink size={13} /></Link>
          <OpenChatButton basePath="/admin/chats" request={{ type: 'SELLER_SUPPORT', storeId: Number(s.storeId), context: { type: 'STORE', id: Number(s.storeId) } }}>판매자와 상담</OpenChatButton>{s.status !== '폐점' && <button onClick={() => { setStatus(s.status); setModal(true); }} className="btn btn-ink btn-sm">상태 변경</button>}</>} />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi label="8주 거래액" value={shortWon(ss.reduce((a, x) => a + x.gross, 0))} unit="원" />
        <Kpi label="8주 수수료 수익" value={comma(ss.reduce((a, x) => a + x.commission, 0) / 10000)} unit="만원" sub={`판매수수료 ${pct(c.commission)}`} />
        <Kpi label="평균 평점" value={s.reviewCount ? s.avg.toFixed(2) : '-'} sub={`리뷰 ${comma(s.reviewCount)}건`} />
        <Kpi label="판매중 상품" value={comma(onSale)} unit="개" sub={`등록 ${comma(prods.length)}개 · 삭제 제외`} />
      </div>
      <div className="grid xl:grid-cols-[1fr_380px] gap-4 mt-4">
        <div className="space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <span className="panel-title">등록 상품 {prods.length}</span>
              <SearchInput value={prodTable.globalFilter} onChange={prodTable.setGlobalFilter} placeholder="상품명 · 상태" className="ml-auto" />
            </div>
            <DataTable table={prodTable.table} loading={prodsLoading} error={prodsError} empty="등록된 상품이 없어요" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <span className="panel-title">정산 이력</span>
              <Link to="/admin/settlements" className="text-[12px] text-mute">정산 관리</Link>
              <SearchInput value={settleTable.globalFilter} onChange={settleTable.setGlobalFilter} placeholder="상태" className="ml-auto" />
            </div>
            <DataTable table={settleTable.table} empty="정산 이력이 없어요" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="panel">
            <img src={s.cover} alt="" className="w-full h-28 object-cover" />
            <div className="p-5"><KV rows={[['상태', <StatusPill s={s.status} />], ['등급', s.grade], ['사업자번호', s.bizNo], ['연락처', s.phone], ['이메일', s.email], ['배송', `${s.courier} · ${won(s.shipFee)}`], ['관심고객', comma(s.followers)]]} /></div>
          </div>
          <div className="panel p-5">
            <div className="panel-title mb-2">관리 메모</div>
            <ul className="text-[12.5px] text-ink-2 space-y-1.5">
              <li><span className="num text-mute">2026.09.12</span> 추석 기획전 참여 확정</li>
              {s.id === 's5' && <li><span className="num text-mute">2026.09.25</span> 반품 미처리 3건 → 정산 보류 / 운영 정지</li>}
              <li><span className="num text-mute">{ymd(s.since)}</span> 입점 승인</li>
            </ul>
          </div>
        </div>
      </div>
      <Modal open={!!blockTarget} onClose={closeBlock} title={blockTarget?.blocked ? '상품 강제 판매중지' : '강제 판매중지 해제'} width={460}
        footer={<><button className="btn btn-line btn-sm" onClick={closeBlock}>취소</button>
          <button className="btn btn-ink btn-sm" onClick={handleBlockSubmit} disabled={block.isPending || (blockTarget?.blocked && blockReason.trim() === '')}>{blockTarget?.blocked ? '판매중지' : '해제'}</button></>}>
        <p className="text-[13.5px] font-semibold">{blockTarget?.product.name}</p>
        <div className="mt-3 text-[13px] text-ink-2 bg-cream p-3 leading-relaxed">
          {blockTarget?.blocked
            ? '쇼핑몰에서 즉시 숨겨지고 구매할 수 없어요. 판매자는 수정 · 재고 변경 · 삭제는 할 수 있지만 판매를 재개할 수 없어요.'
            : '판매중지(STOPPED) 상태로 돌아가요. 판매자가 내용을 점검한 뒤 직접 재개합니다.'}
        </div>
        {blockTarget?.blocked && <>
          <label className="label mt-4" htmlFor="product-block-reason">사유 (판매자 상품 목록에 표시)</label>
          <textarea id="product-block-reason" rows={3} maxLength={255} value={blockReason} onChange={(e) => setBlockReason(e.target.value)} className="field" />
        </>}
      </Modal>
      <Modal open={modal} onClose={() => setModal(false)} title="스토어 상태 변경" width={460}
        footer={<><button className="btn btn-line btn-sm" onClick={() => setModal(false)}>취소</button><button className="btn btn-ink btn-sm" onClick={handleStatusSubmit} disabled={!canSubmit}>변경</button></>}>
        <Segments items={['운영중', '정지']} value={status} onChange={setStatus} />
        <div className="mt-4 text-[13px] text-ink-2 bg-cream p-3 leading-relaxed">
          {status === '운영중' && '스토어와 판매중 상품이 쇼핑몰에 노출됩니다.'}
          {status === '정지' && '상품이 쇼핑몰에서 즉시 숨겨지고 새 스토어 톡이 막힙니다. 지급예정 정산은 자동 보류되고, 해제하면 자동 보류만 풀립니다(직접 건 보류는 그대로).'}
        </div>
        <label className="label mt-4" htmlFor="store-status-reason">사유 (스토어 이력에 기록)</label>
        <textarea id="store-status-reason" rows={3} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} className="field" />
      </Modal>
    </div>
  );
}
