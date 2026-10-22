// 인증 폼 검증 — 담당 이경석 (서버 LoginRequest · SignupRequest 와 같은 규칙. 최종 판단은 서버 · Keycloak)
import { z } from 'zod';

// 이메일 하나만 — 가입 화면 중복확인 버튼에서도 같은 규칙으로
export const emailSchema = z.string().trim().min(1, '이메일을 입력해주세요').email('이메일 형식이 올바르지 않아요').max(100, '이메일은 100자 이하로 입력해주세요');
const email = emailSchema;

export const loginSchema = z.object({
  email,
  password: z.string().min(1, '비밀번호를 입력해주세요'),
});

// 가입 — 비밀번호는 realm 정책과 같게 (8~64자 · 영문 · 특수문자 · 이메일과 다름), 휴대폰은 하이픈 있어도 없어도 됨
export const signupSchema = z.object({
  email,
  password: z.string()
    .min(8, '비밀번호는 8자 이상으로 입력해주세요')
    .max(64, '비밀번호는 64자 이하로 입력해주세요')
    .regex(/^(?=.*[A-Za-z])(?=.*[^A-Za-z0-9]).+$/, '비밀번호는 영문과 특수문자를 포함해야 해요'),
  passwordConfirm: z.string(),
  name: z.string().trim().min(1, '이름을 입력해주세요').max(50, '이름은 50자 이하로 입력해주세요'),
  phone: z.string().trim().regex(/^01[016789]-?\d{3,4}-?\d{4}$/, '휴대폰 번호 형식이 올바르지 않아요'),
})
  .refine((v) => v.password === v.passwordConfirm, { path: ['passwordConfirm'], message: '비밀번호가 일치하지 않아요' })
  .refine((v) => v.password.toLowerCase() !== v.email.toLowerCase(), { path: ['password'], message: '비밀번호는 이메일과 달라야 해요' });
