// 회원정보 폼 검증 — 담당 이경석 (서버 UpdateMyInfoRequest · ChangePasswordRequest 와 같은 규칙. 최종 판단은 서버 · Keycloak)
import { z } from 'zod';

const PHONE = /^01[016789]-?\d{3,4}-?\d{4}$/;

// 회원정보 — 휴대폰은 비워 두면 보내지 않음(소셜 가입은 비어 있을 수 있음), 닉네임은 비우면 삭제
export const profileSchema = z.object({
  name: z.string().trim().min(1, '이름을 입력해주세요').max(50, '이름은 50자 이하로 입력해주세요'),
  nick: z.string().trim().max(30, '닉네임은 30자 이하로 입력해주세요'),
  phone: z.string().trim().refine((v) => v === '' || PHONE.test(v), '휴대폰 번호 형식이 올바르지 않아요'),
});

// 비밀번호 변경 — 새 비밀번호는 가입과 같은 규칙(realm 정책: 8~64자 · 영문 · 특수문자 · 이메일과 다름 — 이메일 비교는 화면에서)
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, '현재 비밀번호를 입력해주세요'),
  newPassword: z.string()
    .min(8, '비밀번호는 8자 이상으로 입력해주세요')
    .max(64, '비밀번호는 64자 이하로 입력해주세요')
    .regex(/^(?=.*[A-Za-z])(?=.*[^A-Za-z0-9]).+$/, '비밀번호는 영문과 특수문자를 포함해야 해요'),
  newPasswordConfirm: z.string(),
}).refine((v) => v.newPassword === v.newPasswordConfirm, { path: ['newPasswordConfirm'], message: '새 비밀번호가 일치하지 않아요' });

// 배송지 — 서버 AddressRequest 와 같은 규칙. 우편번호 · 기본 주소는 주소 검색으로만 채운다
export const addressSchema = z.object({
  label: z.string().trim().min(1, '배송지 이름을 입력해주세요').max(30, '배송지 이름은 30자 이하로 입력해주세요'),
  name: z.string().trim().min(1, '받는 분을 입력해주세요').max(50, '받는 분은 50자 이하로 입력해주세요'),
  phone: z.string().trim().regex(PHONE, '휴대폰 번호 형식이 올바르지 않아요'),
  zip: z.string().regex(/^\d{5}$/, '주소 검색으로 주소를 선택해주세요'),
  addr: z.string().trim().min(1, '주소 검색으로 주소를 선택해주세요').max(200, '주소는 200자 이하예요'),
  detail: z.string().trim().max(200, '상세 주소는 200자 이하로 입력해주세요'),
  main: z.boolean(),
});

// 바뀐 항목만 요청에 — 서버는 생략한 항목을 그대로 둔다. 휴대폰은 비우면 보내지 않음(지우기는 지원 안 함)
export function toUpdateMeRequest(me, values) {
  const request = {};
  if (values.name !== me.name) request.name = values.name;
  if (values.nick !== (me.nick ?? '')) request.nick = values.nick; // '' = 삭제
  if (values.phone !== '' && values.phone.replace(/-/g, '') !== (me.phone ?? '').replace(/-/g, '')) request.phone = values.phone;
  return request;
}
