// settlement 도메인 API (판매자 정산) — 담당 구지훈. 게이트웨이 /api/seller/settlements/** → settlement-service (X-Store-Id 로 내 스토어만)
import { axiosInstance } from '@/shared/api/axiosInstance';

const STATUS_LABEL = { SCHEDULED: '지급예정', HELD: '지급보류', PAID: '지급완료' };
const kstDate = (ymd) => (ymd ? new Date(`${ymd}T00:00:00+09:00`) : null);

// 정산서 요약(목록 · 상세 머리) → 화면 필드. 지급일 = 지급 완료면 paidAt, 아니면 예정일(다음 주 목요일)
export const toSellerSettlement = (s) => ({
  id: s.id,
  week: s.week,
  storeName: s.storeName,
  start: kstDate(s.weekStart),
  end: kstDate(s.weekEnd),
  orders: s.itemCount,
  carriedOver: s.carriedOverCount,
  gross: s.salesAmt,
  commission: s.commissionAmt,
  pgFee: s.paymentFeeAmt,
  payout: s.payoutAmt,
  pay: s.paidAt ? new Date(s.paidAt) : kstDate(s.scheduledPayDate),
  status: STATUS_LABEL[s.status] ?? s.status,
  holdReason: s.holdReason ?? '',
  bank: s.bank?.bankName ? `${s.bank.bankName} ${s.bank.accountNumber} (${s.bank.accountHolder})` : '-',
});

// 상위 카테고리 이름 — 공개 카테고리 트리(GET /api/categories). 적용 수수료율 표시용
const fetchCategoryNames = async () =>
  Object.fromEntries((await axiosInstance.get('/api/categories')).data.data.map((c) => [c.id, c.name]));

// GET /api/seller/settlements → { summary, rows }. 요약: 다음 지급 · 최근 8주 지급 · 이번 주 정산 예정 · 적용 수수료율(%)
export const fetchSellerSettlements = async () => {
  const [{ summary, settlements }, names] = await Promise.all([
    axiosInstance.get('/api/seller/settlements').then((r) => r.data.data),
    fetchCategoryNames().catch(() => ({})), // 이름만 못 가져오면 번호로 표시
  ]);
  return {
    summary: {
      nextPayout: summary.nextPayout && { payout: summary.nextPayout.payoutAmt, pay: kstDate(summary.nextPayout.scheduledPayDate), week: summary.nextPayout.week },
      paidRecent8Weeks: summary.paidRecent8WeeksAmt,
      pendingPayout: summary.pendingPayoutAmt,
      rates: summary.appliedRates.map((r) => ({ categoryId: r.categoryId, name: names[r.categoryId] ?? `카테고리 ${r.categoryId}`, rate: Number(r.rate) / 100 })),
    },
    rows: settlements.map(toSellerSettlement),
  };
};

// 판매자 대시보드(박지연)용 — 이번 주(집계 전) 구매확정분의 정산 예정액. 같은 API 의 요약에서
export const fetchSellerPending = async () => ({
  payout: (await axiosInstance.get('/api/seller/settlements')).data.data.summary.pendingPayoutAmt,
});

// GET /api/seller/settlements/{id} — 건별 상품주문(이월 표시) · 상태 이력. 관리자 상세와 같은 모양
export const toSettlementDetail = (d) => ({
  ...toSellerSettlement(d.settlement),
  items: d.items.map((i) => ({
    orderItemId: i.orderItemId,
    orderNo: i.orderNo,
    productName: i.productName,
    confirmedAt: new Date(i.confirmedAt),
    amount: i.itemAmt,
    rate: Number(i.rate) / 100,
    commission: i.commission,
    pgFee: i.paymentFee,
    payout: i.payout,
    carriedOver: i.carriedOver,
  })),
  history: d.history.map((h) => ({ at: h.at ? new Date(h.at) : null, actor: h.actor, from: STATUS_LABEL[h.from] ?? null, to: STATUS_LABEL[h.to] ?? h.to, reason: h.reason ?? '' })),
});
export const fetchSellerSettlement = async (id) => toSettlementDetail((await axiosInstance.get(`/api/seller/settlements/${id}`)).data.data);

// GET /api/seller/settlements/{id}/report → { url, expiresAt } — presigned 10분, 누를 때마다 새로 발급. 지급 전 409 SETTLE_REPORT_NOT_READY
export const fetchSettlementReportUrl = async (id) => (await axiosInstance.get(`/api/seller/settlements/${id}/report`)).data.data.url;
