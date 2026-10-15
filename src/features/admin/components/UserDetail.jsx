// 회원 상세 — 담당 구지훈
import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { PageHead, StatusPill, Modal, KV, Kpi, Stars, Pill, GradeBadge } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/common/DataTable';
import { SearchInput } from '@/shared/components/common/SearchInput';
import { useClientTable } from '@/shared/hooks/useClientTable';
import { useAdminUsersQuery } from '@/features/admin/hooks/useAdminUsersQuery';
import { useAdminUserPointsQuery } from '@/features/admin/hooks/useAdminUserPointsQuery';
import { useAdminReviewsQuery } from '@/features/admin/hooks/useAdminReviewsQuery';
import { useAdminProductsQuery } from '@/features/admin/hooks/useAdminProductsQuery';
import { nextGrade } from '@/features/user/constants';
import { toMap } from '@/shared/utils/collection';
import { toast } from '@/shared/stores/toastStore';
import { won, comma, ymd, ymdhm, cx } from '@/shared/utils/format';

const POINT_COLUMNS = [
  { accessorKey: 'date', header: '일자', sortingFn: 'datetime', meta: { tdClass: 'num text-ink-2', search: false }, cell: ({ getValue }) => ymd(getValue()) },
  { accessorKey: 'type', header: '구분', cell: ({ getValue }) => <StatusPill s={getValue()} /> },
  { accessorKey: 'desc', header: '내용' },
  {
    accessorKey: 'amount', header: '포인트', meta: { thClass: 'text-right', tdClass: 'text-right num font-semibold', search: false },
    cell: ({ getValue }) => <span className={cx(getValue() < 0 && 'text-rust')}>{getValue() > 0 ? '+' : ''}{comma(getValue())}P</span>,
  },
];

export default function UserDetail() {
  const { id } = useParams();
  const { data: users = [], isLoading } = useAdminUsersQuery();
  const u = users.find((x) => x.id === id);
  if (isLoading) return <p className="text-mute py-10 text-center">불러오는 중…</p>;
  if (!u) return <p className="text-mute py-10 text-center">회원을 찾을 수 없어요</p>;
  return <DetailBody key={u.id} u={u} />; // key: 다른 회원으로 이동하면 모달 · 검색 상태 초기화
}

function DetailBody({ u }) {
  const [modal, setModal] = useState(null);
  const { data: ph = [], isLoading: pointsLoading } = useAdminUserPointsQuery(u.id);
  const { data: reviews = [] } = useAdminReviewsQuery();
  const { data: products = [] } = useAdminProductsQuery();
  const productById = useMemo(() => toMap(products), [products]);
  const urev = useMemo(() => reviews.filter((r) => r.userId === u.id).slice(0, 5), [reviews, u.id]);
  const next = nextGrade(u.spent);
  const { table, globalFilter, setGlobalFilter } = useClientTable({ data: ph, columns: POINT_COLUMNS, initialSorting: [{ id: 'date', desc: true }] });

  const handleBanConfirm = () => {
    // TODO(구지훈): useChangeUserStatusMutation
    setModal(null);
    toast('처리되었어요');
  };

  return (
    <div>
      <PageHead crumbs="회원 · 콘텐츠 > 회원 관리" title={<span className="flex items-center gap-2">{u.name} <GradeBadge grade={u.grade} /></span>} desc={`${u.email} · 가입 ${ymd(u.joined)}`}
        right={<button onClick={() => setModal('ban')} className={cx('btn btn-sm', u.status === '이용정지' ? 'btn-ink' : 'btn-line text-rust')}>{u.status === '이용정지' ? '정지 해제' : '이용 정지'}</button>} />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi label="회원등급" value={u.grade} sub={next ? `${next.id}까지 ${won(next.min - u.spent)}` : '최고 등급'} />
        <Kpi label="누적 주문" value={u.orders} unit="건" />
        <Kpi label="누적 구매확정 금액" value={comma(u.spent)} unit="원" />
        <Kpi label="보유 포인트" value={comma(u.point)} unit="P" sub="적립률 5% (실결제금액 기준)" />
      </div>
      <div className="grid xl:grid-cols-[360px_1fr] gap-4 mt-4">
        <div className="panel">
          <div className="p-5 flex items-center gap-3 border-b border-line"><img src={u.avatar} alt="" className="w-12 h-12 rounded-full object-cover" /><div><b>{u.name}</b> <span className="text-mute text-[13px]">({u.nick})</span><div><StatusPill s={u.status} /></div></div></div>
          <div className="p-5"><KV rows={[['회원번호', u.id.toUpperCase()], ['휴대폰', u.phone], ['회원등급', <GradeBadge grade={u.grade} />], ['최근 접속', ymdhm(u.lastLogin)], ['마케팅 수신', '동의 (2025.03.02)']]} /></div>
          {u.memo && <div className="mx-5 mb-5 bg-rust-soft text-rust text-[13px] p-3">{u.memo}</div>}
        </div>
        <div className="space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <span className="panel-title">포인트 내역</span>
              <span className="text-[12px] text-mute">최근 {ph.length}건</span>
              <SearchInput value={globalFilter} onChange={setGlobalFilter} placeholder="구분 · 내용" className="ml-auto" />
            </div>
            <DataTable table={table} loading={pointsLoading} empty="포인트 내역이 없어요" />
          </div>
          <div className="panel">
            <div className="panel-head"><span className="panel-title">작성 리뷰</span></div>
            {urev.length === 0 && <div className="py-10 text-center text-mute text-sm">작성한 리뷰가 없습니다.</div>}
            {urev.map((r) => (
              <div key={r.id} className="px-5 py-3.5 border-b border-line last:border-0 text-[13px]">
                <div className="flex items-center gap-2"><Stars value={r.rating} size={11} /><span className="text-mute">{ymd(r.date)} · {productById[r.productId]?.name}</span>{r.blinded && <Pill tone="rust">블라인드</Pill>}</div>
                <p className="mt-1 text-ink-2">{r.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Modal open={modal === 'ban'} onClose={() => setModal(null)} title={u.status === '이용정지' ? '이용 정지 해제' : '이용 정지'} width={440}
        footer={<><button className="btn btn-line btn-sm" onClick={() => setModal(null)}>취소</button><button className="btn btn-ink btn-sm" onClick={handleBanConfirm}>확인</button></>}>
        {u.status !== '이용정지' && <><label className="label">정지 기간</label><select className="field mb-3"><option>7일</option><option>30일</option><option>영구</option></select><label className="label">사유</label><select className="field mb-3"><option>허위 리뷰 / 리뷰 어뷰징</option><option>결제 도용 의심</option><option>욕설 · 비방</option></select></>}
        <textarea rows={3} className="field" placeholder="내부 메모" />
      </Modal>
    </div>
  );
}
