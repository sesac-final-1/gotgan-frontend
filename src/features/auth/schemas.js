// 인증 폼 검증 — 담당 이경석 (서버 LoginRequest 와 같은 규칙: 이메일 형식 · 비밀번호 빈 값 금지)
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().min(1, '이메일을 입력해주세요').email('이메일 형식이 올바르지 않아요'),
  password: z.string().min(1, '비밀번호를 입력해주세요'),
});
