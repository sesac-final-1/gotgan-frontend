// 회원가입 — 담당 이경석. 자체 폼 → user-service(Keycloak 계정 생성 대리) → 자동 로그인 (컨벤션 4-4)
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Checkbox } from '@/shared/components/ui';
import { toast } from '@/shared/stores/toastStore';
import { checkEmailAvailability, signup } from '@/features/auth/api/authApi';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { emailSchema, signupSchema } from '@/features/auth/schemas';
import { SIGNUP_AGREEMENTS, SIGNUP_FALLBACK_MESSAGE } from '@/features/auth/constants';

const EMPTY = { email: '', password: '', passwordConfirm: '', name: '', phone: '' };
const serverMessage = (err) => err.response?.data?.message ?? SIGNUP_FALLBACK_MESSAGE;

function FieldError({ message }) {
  return message ? <p className="mt-1 text-[12px] text-rust">{message}</p> : null;
}

export default function ShopSignup() {
  const nav = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [emailCheck, setEmailCheck] = useState(null); // { email, available } — 확인한 이메일과 지금 입력이 같을 때만 유효
  const [agreed, setAgreed] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const normalizedEmail = form.email.trim().toLowerCase();
  const emailConfirmed = emailCheck?.available && emailCheck.email === normalizedEmail;
  const allAgreed = SIGNUP_AGREEMENTS.every((a) => agreed[a.id]);
  const requiredAgreed = SIGNUP_AGREEMENTS.filter((a) => a.required).every((a) => agreed[a.id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };
  const handleAllAgree = (checked) => setAgreed(Object.fromEntries(SIGNUP_AGREEMENTS.map((a) => [a.id, checked])));

  const handleEmailCheck = async () => {
    const parsed = emailSchema.safeParse(form.email);
    if (!parsed.success) {
      setErrors((prev) => ({ ...prev, email: parsed.error.issues[0].message }));
      return;
    }
    try {
      const result = await checkEmailAvailability(parsed.data);
      setEmailCheck(result);
      setErrors((prev) => ({ ...prev, email: result.available ? undefined : '이미 가입된 이메일이에요' }));
    } catch (err) {
      setErrors((prev) => ({ ...prev, email: serverMessage(err) }));
    }
  };

  // 인증 액션은 API 직접 호출 (컨벤션 4-6 예외)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    const parsed = signupSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message]).reverse())); // 칸마다 첫 오류
      return;
    }
    if (!emailConfirmed) {
      setErrors((prev) => ({ ...prev, email: '이메일 중복확인을 해주세요' }));
      return;
    }
    if (!requiredAgreed) {
      setFormError('필수 약관에 모두 동의해주세요');
      return;
    }
    setSubmitting(true);
    try {
      const { email, password, name, phone } = parsed.data;
      const { login } = await signup({ email, password, name, phone });
      if (login) {
        useAuthStore.getState().setAuth({ accessToken: login.accessToken, user: login.user });
        toast(`${login.user.name}님, 가입을 환영해요!`);
        void nav('/', { replace: true });
      } else {
        // 가입은 됐지만 자동 로그인 실패 (인증 서버 일시 장애) — 같은 정보로 로그인하면 된다
        toast('가입이 완료됐어요. 로그인해주세요');
        void nav('/login', { replace: true });
      }
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'AUTH_EMAIL_DUPLICATE') {
        setEmailCheck(null);
        setErrors((prev) => ({ ...prev, email: serverMessage(err) }));
      } else if (code === 'AUTH_PASSWORD_POLICY_VIOLATION') {
        setErrors((prev) => ({ ...prev, password: serverMessage(err) }));
      } else {
        setFormError(serverMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[440px] mx-auto px-4 pt-16">
      <h1 className="text-[26px] font-bold tracking-tight">회원가입</h1>
      <p className="mt-1 text-sm text-mute">결제할 때마다 실결제금액의 5%가 포인트로 적립돼요.</p>
      <form className="mt-8 space-y-4" onSubmit={handleSubmit} noValidate>
        <div>
          <label className="label" htmlFor="signup-email">이메일</label>
          <div className="flex gap-2">
            <input id="signup-email" name="email" type="email" autoComplete="email" className="field" placeholder="example@email.com"
              value={form.email} onChange={handleChange} />
            <button type="button" onClick={handleEmailCheck} className="btn btn-line shrink-0">중복확인</button>
          </div>
          {emailConfirmed && !errors.email && <p className="mt-1 text-[12px] text-ink-2">사용할 수 있는 이메일이에요</p>}
          <FieldError message={errors.email} />
        </div>
        <div>
          <label className="label" htmlFor="signup-password">비밀번호</label>
          <input id="signup-password" name="password" type="password" autoComplete="new-password" className="field"
            placeholder="영문 · 특수문자 포함 8자 이상" value={form.password} onChange={handleChange} />
          <FieldError message={errors.password} />
        </div>
        <div>
          <label className="label" htmlFor="signup-password-confirm">비밀번호 확인</label>
          <input id="signup-password-confirm" name="passwordConfirm" type="password" autoComplete="new-password" className="field"
            value={form.passwordConfirm} onChange={handleChange} />
          <FieldError message={errors.passwordConfirm} />
        </div>
        <div>
          <label className="label" htmlFor="signup-name">이름</label>
          <input id="signup-name" name="name" autoComplete="name" className="field" value={form.name} onChange={handleChange} />
          <FieldError message={errors.name} />
        </div>
        <div>
          <label className="label" htmlFor="signup-phone">휴대폰 번호</label>
          <input id="signup-phone" name="phone" type="tel" autoComplete="tel" className="field" placeholder="010-0000-0000"
            value={form.phone} onChange={handleChange} />
          <FieldError message={errors.phone} />
        </div>
        <div className="border border-line p-4 space-y-2.5 text-[13px]">
          <Checkbox checked={allAgreed} onChange={handleAllAgree} label={<b>전체 동의</b>} />
          <div className="h-px bg-line" />
          {SIGNUP_AGREEMENTS.map((a) => (
            <Checkbox key={a.id} checked={!!agreed[a.id]} onChange={(checked) => setAgreed((prev) => ({ ...prev, [a.id]: checked }))} label={a.label} />
          ))}
        </div>
        {formError && <p role="alert" className="text-[13px] text-rust">{formError}</p>}
        <button type="submit" className="btn btn-ink btn-lg w-full" disabled={submitting}>{submitting ? '가입 중…' : '가입하기'}</button>
      </form>
    </div>
  );
}
