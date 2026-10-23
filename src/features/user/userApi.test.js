import { axiosInstance } from '@/shared/api/axiosInstance';
import { fetchMe, fetchMyPoints, toPointRow } from '@/features/user/api/userApi';
import { DEFAULT_AVATAR, nextGrade } from '@/features/user/constants';

afterEach(() => vi.restoreAllMocks());

const ME = {
  userId: 4, email: 'buyer1@gotgan.com', name: '구매자1', nick: null, phone: null, grade: 'SILVER',
  signupProvider: 'KAKAO', point: 1500, totalSpent: 320000, joinedAt: '2026-10-01T09:30:00+09:00',
};

describe('fetchMe — GET /api/users/me 를 화면 필드로', () => {
  it('userId → id, totalSpent → spent, joinedAt → Date, 비어 있는 닉네임 · 휴대폰은 빈 문자열, 기본 프로필', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: ME } });

    const me = await fetchMe();

    expect(get).toHaveBeenCalledWith('/api/users/me');
    expect(me).toMatchObject({ id: 4, email: 'buyer1@gotgan.com', name: '구매자1', nick: '', phone: '', grade: 'SILVER',
      signupProvider: 'KAKAO', point: 1500, spent: 320000, avatar: DEFAULT_AVATAR });
    expect(me.joined).toEqual(new Date('2026-10-01T00:30:00Z'));
    expect(nextGrade(me.spent)).toMatchObject({ id: 'GOLD' }); // 마이페이지 상단 "다음 등급까지"
  });
});

describe('fetchMyPoints — GET /api/users/me/points 를 화면 필드로', () => {
  it('잔액 그대로, 이력은 구분 라벨 · 부호 있는 금액 · 잔액 · 주문번호 · Date', async () => {
    vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: { balance: 800, history: [
      { id: 3, type: 'RESTORE', amount: 100, balanceAfter: 800, orderNo: '20261022-0009', createdAt: '2026-10-22T14:20:00+09:00' },
      { id: 2, type: 'USE', amount: 300, balanceAfter: 700, orderNo: '20261022-0009', createdAt: '2026-10-22T14:00:00+09:00' },
    ] } } });

    const { balance, history } = await fetchMyPoints();

    expect(balance).toBe(800);
    expect(history[0]).toMatchObject({ id: '3', type: '환원', amount: 100, balance: 800, ref: '20261022-0009' });
    expect(history[1]).toMatchObject({ type: '사용', amount: -300, balance: 700 });
    expect(history[0].date).toEqual(new Date('2026-10-22T05:20:00Z'));
  });

  it('구분 4종의 부호 — 적립 · 환원은 +, 사용 · 회수는 −, 주문번호 없으면 빈 문자열', () => {
    const row = (type) => toPointRow({ id: 1, type, amount: 50, balanceAfter: 0, orderNo: null, createdAt: '2026-10-22T00:00:00+09:00' });
    expect(['EARN', 'USE', 'RESTORE', 'RECLAIM'].map((t) => [row(t).type, row(t).amount]))
      .toEqual([['적립', 50], ['사용', -50], ['환원', 50], ['회수', -50]]);
    expect(row('EARN').ref).toBe('');
    expect(row('EARN').desc).toContain('결제 적립');
  });
});
