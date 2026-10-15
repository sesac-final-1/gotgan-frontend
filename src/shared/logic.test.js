import { queryKeys } from '@/shared/api/queryKeys';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { useToastStore, toast } from '@/shared/stores/toastStore';
import { ratingSummary } from '@/features/review/utils/ratingSummary';
import { GRADES, gradeById, nextGrade, earnOf } from '@/features/user/constants';
import { FLOW, CLAIMS, CLAIM_TYPE, STATUS_TONE } from '@/features/order/constants';
import { PAYMENT_FEE } from '@/features/settlement/constants';
import { FAQ_CATS, faqs } from '@/features/support/data/faq';

describe('queryKeys', () => {
  // 키 규칙: [도메인, ...] — 도메인 단위 invalidate(queryKeys.{도메인}.all)가 하위 키를 모두 잡아야 한다
  const entries = Object.entries(queryKeys).flatMap(([domain, keys]) =>
    Object.entries(keys).filter(([, v]) => typeof v === 'function').map(([name, fn]) => [domain, name, fn]));

  it.each(entries)('%s.%s 는 도메인 이름으로 시작', (domain, _, fn) => {
    const key = fn('x');
    expect(key[0]).toBe(domain);
    expect(key.slice(0, queryKeys[domain].all.length)).toEqual(queryKeys[domain].all);
  });

  it('서버 페이징 키는 params 가 없어도 같은 모양', () => {
    expect(queryKeys.order.sellerItems()).toEqual(['order', 'seller', 'items', {}]);
    expect(queryKeys.order.sellerItems({ page: 2 })).toEqual(['order', 'seller', 'items', { page: 2 }]);
  });
});

describe('axiosInstance', () => {
  it('같은 출처 /api · 쿠키 전송', () => {
    expect(axiosInstance.defaults.baseURL).toBe('');
    expect(axiosInstance.defaults.withCredentials).toBe(true);
  });
});

describe('toast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('2.3초 뒤 사라지고, 새 토스트가 뜨면 이전 타이머는 지우지 않는다', () => {
    toast('첫 번째');
    expect(useToastStore.getState().current.msg).toBe('첫 번째');
    vi.advanceTimersByTime(1000);
    toast('두 번째');
    vi.advanceTimersByTime(1300); // 첫 타이머 만료 — 두 번째는 유지
    expect(useToastStore.getState().current.msg).toBe('두 번째');
    vi.advanceTimersByTime(1000);
    expect(useToastStore.getState().current).toBeNull();
  });
});

describe('ratingSummary', () => {
  it('평균 · 별점 분포', () => {
    const s = ratingSummary([{ rating: 5 }, { rating: 4 }, { rating: 5 }]);
    expect(s.total).toBe(3);
    expect(s.avg).toBeCloseTo(4.67, 2);
    expect(s.dist.find((d) => d.star === 5).count).toBe(2);
  });

  it('리뷰 0건은 평균 0', () => {
    expect(ratingSummary([])).toMatchObject({ avg: 0, total: 0 });
  });
});

describe('업무 상수', () => {
  it('등급 · 다음 등급 · 5% 적립', () => {
    expect(gradeById.GOLD.label).toBe('골드');
    expect(nextGrade(0).id).toBe('SILVER');
    expect(nextGrade(500000).id).toBe('GOLD');
    expect(nextGrade(GRADES.at(-1).min)).toBeNull();
    expect(earnOf(12345)).toBe(617);
  });

  it('주문 상태 · 클레임 · 수수료', () => {
    expect(FLOW.at(-1)).toBe('구매확정');
    expect(CLAIMS.every((c) => CLAIM_TYPE[c] && STATUS_TONE[c])).toBe(true);
    expect(PAYMENT_FEE).toBe(0.022);
  });

  it('FAQ 데이터', () => {
    expect(faqs.every((f) => FAQ_CATS.includes(f.cat))).toBe(true);
  });
});
