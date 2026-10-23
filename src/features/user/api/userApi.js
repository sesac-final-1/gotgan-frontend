// user 도메인 API — 담당 이경석
// 응답은 화면이 쓰던 목업 필드 이름으로 바꿔 넘긴다 — 화면 수정 없음 (docs/MOCK-TO-API.md 2절)
import { axiosInstance } from '@/shared/api/axiosInstance';
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

// PATCH /api/users/me — { name?, nick?, phone? } 보낸 항목만 수정(닉네임 '' = 삭제) → 수정 후 내 정보
export const updateMe = async (request) => toMe((await axiosInstance.patch('/api/users/me', request)).data.data);

// PATCH /api/users/me/password — { currentPassword, newPassword }. 토큰 · 세션은 그대로 (로그인 유지)
export const changePassword = (request) => axiosInstance.patch('/api/users/me/password', request);

// DELETE /api/users/me — 탈퇴 (Keycloak 계정 삭제 → 로그인 · 재발급 불가). 판매자는 스토어 폐점 전 409
export const withdraw = () => axiosInstance.delete('/api/users/me');

// 배송지 — 응답 Address { id, label, name, phone, zip, addr, detail, main } 가 화면 필드와 같아 변환 없음
// GET 은 기본 배송지 먼저 · 최근 등록순, 최대 5개라 페이징 없음
export const fetchMyAddresses = async () => (await axiosInstance.get('/api/users/me/addresses')).data.data;

// POST — 201 등록된 배송지. 첫 배송지는 main 과 관계없이 기본, 5개 초과 409 ADDRESS_LIMIT_EXCEEDED
export const createAddress = async (request) => (await axiosInstance.post('/api/users/me/addresses', request)).data.data;

// PUT /{id} — 내용 전체 교체 (main=false 로 와도 지금 기본이면 기본 유지)
export const updateAddress = async (id, request) => (await axiosInstance.put(`/api/users/me/addresses/${id}`, request)).data.data;

// DELETE /{id} — 소프트 삭제. 기본 배송지는 409 ADDRESS_DEFAULT_DELETE_NOT_ALLOWED
export const deleteAddress = (id) => axiosInstance.delete(`/api/users/me/addresses/${id}`);

// PATCH /{id}/main — 기본 배송지로 (기존 기본 해제)
export const markDefaultAddress = async (id) => (await axiosInstance.patch(`/api/users/me/addresses/${id}/main`)).data.data;

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
