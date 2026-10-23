// user 도메인 API — 담당 이경석
// 응답은 화면이 쓰던 목업 필드 이름으로 바꿔 넘긴다 — 화면 수정 없음 (docs/MOCK-TO-API.md 2절)
import { axiosInstance } from '@/shared/api/axiosInstance';
import { mockResolve } from '@/mocks/mockApi';
import { myAddresses } from '@/mocks/fixtures/people';
import { DEFAULT_AVATAR, POINT_TYPE_BY_CODE } from '@/features/user/constants';

// GET /api/users/me — { userId, email, name, nick, phone, grade, signupProvider, point, totalSpent, joinedAt(+09:00) }
export const toMe = (r) => ({
  id: r.userId,
  email: r.email,
  name: r.name,
  nick: r.nick ?? '',
  phone: r.phone ?? '',
  grade: r.grade,
  signupProvider: r.signupProvider, // LOCAL 이 아니면(소셜 가입) 비밀번호 변경 불가 · 휴대폰이 비어 있을 수 있음
  point: r.point,
  spent: r.totalSpent,
  joined: r.joinedAt ? new Date(r.joinedAt) : null,
  avatar: DEFAULT_AVATAR,
});

export const fetchMe = async () => toMe((await axiosInstance.get('/api/users/me')).data.data);

// TODO(이경석): GET /api/users/me/addresses
export const fetchMyAddresses = () => mockResolve(myAddresses);

// GET /api/users/me/points — { balance, history[{ id, type, amount(양수), balanceAfter, orderNo, createdAt }] } 최신순 전체
export const toPointRow = (h) => {
  const t = POINT_TYPE_BY_CODE[h.type] ?? { label: h.type, sign: 1, desc: '' };
  return {
    id: String(h.id),
    date: new Date(h.createdAt),
    type: t.label,
    desc: t.desc,
    ref: h.orderNo ?? '',
    amount: t.sign * h.amount,
    balance: h.balanceAfter,
  };
};

export const fetchMyPoints = async () => {
  const { balance, history } = (await axiosInstance.get('/api/users/me/points')).data.data;
  return { balance, history: history.map(toPointRow) };
};
