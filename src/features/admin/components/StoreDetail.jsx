// 스토어 상세 — 담당 구지훈
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ExternalLink } from 'lucide-react';
import { PageHead, Segments, StatusPill, Modal, KV, Kpi } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/common/DataTable';
import { SearchInput } from '@/shared/components/common/SearchInput';
import { useClientTable } from '@/shared/hooks/useClientTable';
import { useAdminStoresQuery } from '@/features/admin/hooks/useAdminStoresQuery';
import { useAdminSettlementsQuery } from '@/features/admin/hooks/useAdminSettlementsQuery';
import { useAdminReviewsQuery } from '@/features/admin/hooks/useAdminReviewsQuery';
import { useAdminCategoriesQuery } from '@/features/admin/hooks/useAdminCategoriesQuery';
import { useAdminProductsQuery } from '@/features/admin/hooks/useAdminProductsQuery';
import { ratingSummary } from '@/features/review/utils/ratingSummary';
import { toast } from '@/shared/stores/toastStore';
import { won, comma, ymd, pct, shortWon } from '@/shared/utils/format';

const NUM = { thClass: 'text-right', tdClass: 'text-right num', search: false };

function handleForceStop() {
  // TODO(구지훈): useForceStopProductMutation
  toast('상품을 강제 판매중지했어요 (판매자에게 사유 통보)');
}

const PRODUCT_COLUMNS = [
  {
    accessorKey: 'name', header: '상품',
    cell: ({ row }) => <div className="flex items-center gap-2.5"><img src={row.original.images[0]} alt="" className="w-9 h-9 object-cover" />{row.original.name}</div>,
  },
  { accessorKey: 'price', header: '판매가', meta: NUM, cell: ({ getValue }) => comma(getValue()) },
  { accessorKey: 'stock', header: '재고', meta: NUM },
  { accessorKey: 'sold', header: '판매량', meta: NUM, cell: ({ getValue }) => comma(getValue()) },
  { accessorKey: 'status', header: '상태', cell: ({ getValue }) => <StatusPill s={getValue()} /> },
  {
    id: 'action', header: '', enableSorting: false, meta: { search: false },
    cell: () => <button onClick={handleForceStop} className="btn btn-ghost btn-xs text-rust">강제중지</button>,
  },
];

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
  const { data: stores = [], isLoading } = useAdminStoresQuery();
  const s = stores.find((x) => x.id === id);
  if (isLoading) return <p className="text-mute py-10 text-center">불러오는 중…</p>;
  if (!s) return <p className="text-mute py-10 text-center">스토어를 찾을 수 없어요</p>;
  return <DetailBody key={s.id} s={s} />; // key: 다른 스토어로 이동하면 상태 변경 모달 상태 초기화
}

function DetailBody({ s }) {
  const [status, setStatus] = useState(s.status);
  const [modal, setModal] = useState(false);
  const { data: settlements = [] } = useAdminSettlementsQuery();
  const { data: reviews = [] } = useAdminReviewsQuery();
  const { data: categories = [] } = useAdminCategoriesQuery();
  const { data: products = [] } = useAdminProductsQuery();
  const ss = useMemo(() => settlements.filter((x) => x.storeId === s.id), [settlements, s.id]);
  const prods = useMemo(() => products.filter((p) => p.storeId === s.id), [products, s.id]);
  const sum = useMemo(() => ratingSummary(reviews.filter((r) => r.storeId === s.id)), [reviews, s.id]);
  const c = categories.find((x) => x.id === s.cat) ?? { name: s.cat, commission: 0 };

  const prodTable = useClientTable({ data: prods, columns: PRODUCT_COLUMNS });
  const settleTable = useClientTable({ data: ss, columns: SETTLEMENT_COLUMNS, initialSorting: [{ id: 'start', desc: true }] });

  const handleStatusSubmit = () => {
    // TODO(구지훈): useChangeStoreStatusMutation
    setModal(false);
    toast(`스토어 상태: ${status}`);
  };
  const handleCommissionApply = () => {
    // TODO(구지훈): useUpdateStoreCommissionMutation
    toast('개별 수수료율이 다음 정산부터 적용됩니다');
  };

  return (
    <div>
      <PageHead crumbs="판매자 > 스토어 관리" title={s.name} desc={`${c.name} · ${s.owner} · 입점 ${ymd(s.since)}`}
        right={<><Link to={`/store/${s.id}`} className="btn btn-line btn-sm">쇼핑몰에서 보기 <ExternalLink size={13} /></Link><button onClick={() => setModal(true)} className="btn btn-ink btn-sm">상태 변경</button></>} />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi label="8주 거래액" value={shortWon(ss.reduce((a, x) => a + x.gross, 0))} unit="원" />
        <Kpi label="8주 수수료 수익" value={comma(ss.reduce((a, x) => a + x.commission, 0) / 10000)} unit="만원" sub={`판매수수료 ${pct(c.commission)}`} />
        <Kpi label="평균 평점" value={sum.avg.toFixed(2)} sub={`리뷰 ${sum.total}건`} />
        <Kpi label="페널티 점수" value={s.id === 's5' ? '7' : '0'} unit="/ 10점" sub="10점 도달 시 판매 제한" />
      </div>
      <div className="grid xl:grid-cols-[1fr_380px] gap-4 mt-4">
        <div className="space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <span className="panel-title">등록 상품 {prods.length}</span>
              <SearchInput value={prodTable.globalFilter} onChange={prodTable.setGlobalFilter} placeholder="상품명 · 상태" className="ml-auto" />
            </div>
            <DataTable table={prodTable.table} empty="등록된 상품이 없어요" />
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
            <div className="p-5"><KV rows={[['상태', <StatusPill s={status} />], ['등급', s.grade], ['사업자번호', s.bizNo], ['연락처', s.phone], ['이메일', s.email], ['배송', `${s.courier} · ${won(s.shipFee)}`]]} /></div>
          </div>
          <div className="panel p-5 space-y-3">
            <div className="panel-title">수수료 개별 설정</div>
            <div className="flex items-center gap-2"><input className="field num w-24" defaultValue={(c.commission * 100).toFixed(1)} /><span>%</span><button onClick={handleCommissionApply} className="btn btn-line btn-sm">적용</button></div>
            <p className="text-[12px] text-mute">카테고리 기본값 {pct(c.commission)} · 프로모션/협의 시 개별 조정</p>
          </div>
          <div className="panel p-5">
            <div className="panel-title mb-2">관리 메모</div>
            <ul className="text-[12.5px] text-ink-2 space-y-1.5">
              <li><span className="num text-mute">2026.09.12</span> 추석 기획전 참여 확정</li>
              {s.id === 's5' && <li><span className="num text-mute">2026.09.25</span> 반품 미처리 3건 → 정산 보류 / 휴면 전환</li>}
              <li><span className="num text-mute">{ymd(s.since)}</span> 입점 승인</li>
            </ul>
          </div>
        </div>
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title="스토어 상태 변경" width={460}
        footer={<><button className="btn btn-line btn-sm" onClick={() => setModal(false)}>취소</button><button className="btn btn-ink btn-sm" onClick={handleStatusSubmit}>변경</button></>}>
        <Segments items={['운영중', '휴면', '정지']} value={status} onChange={setStatus} />
        <div className="mt-4 text-[13px] text-ink-2 bg-cream p-3 leading-relaxed">
          {status === '운영중' && '스토어와 판매중 상품이 쇼핑몰에 노출됩니다.'}
          {status === '휴면' && '스토어/상품이 비노출됩니다. 진행 중 주문은 처리 가능하며, 정산은 클레임 완료 후 지급됩니다.'}
          {status === '정지' && '즉시 비노출 + 판매자센터 기능 제한. 미정산 금액은 지급보류되며, 분쟁 해소 후 지급됩니다.'}
        </div>
        {status !== '운영중' && <><label className="label mt-4">사유 (판매자에게 통보)</label><textarea rows={3} className="field" /></>}
      </Modal>
    </div>
  );
}
