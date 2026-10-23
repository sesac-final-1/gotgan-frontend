// 마이페이지 회원정보 수정 — 담당 이경석. 내 정보 수정 · 비밀번호 변경 · 탈퇴
import { useState } from 'react';
import { GradeBadge, Modal } from '@/shared/components/ui';
import { MyPageHead } from '@/shared/layouts/MyPageLayout';
import { useMeQuery } from '@/features/user/hooks/useMeQuery';
import { useUpdateMeMutation } from '@/features/user/hooks/useUpdateMeMutation';
import { changePassword, withdraw } from '@/features/user/api/userApi';
import { passwordChangeSchema, profileSchema, toUpdateMeRequest } from '@/features/user/schemas';
import { GRADES, POINT_RATE, SIGNUP_PROVIDER_LABELS } from '@/features/user/constants';
import { toast } from '@/shared/stores/toastStore';
import { cx, won, comma } from '@/shared/utils/format';

const FALLBACK_MESSAGE = '서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요';
const serverMessage = (err) => err.response?.data?.message ?? FALLBACK_MESSAGE;
const firstErrors = (issues) => Object.fromEntries([...issues].reverse().map((i) => [i.path[0], i.message])); // 칸마다 첫 오류

function FieldError({ message }) {
  return message ? <p className="mt-1 text-[12px] text-rust">{message}</p> : null;
}

/**
 * @param onWithdrawn 탈퇴 성공 후 — 로그인 상태 · 캐시 정리와 이동은 페이지가 (auth 는 다른 도메인)
 */
export default function MyProfile({ onWithdrawn }) {
  const { data: me, isLoading } = useMeQuery();
  const [modal, setModal] = useState(null); // 'password' | 'withdraw'
  if (isLoading) return <p className="text-mute py-10 text-center">불러오는 중…</p>;
  if (!me) return <p className="text-mute py-10 text-center">회원 정보를 불러오지 못했어요</p>;
  const social = me.signupProvider && me.signupProvider !== 'LOCAL';

  return (
    <div>
      <MyPageHead>회원정보 수정</MyPageHead>
      <div className="max-w-[520px] space-y-4">
        <img src={me.avatar} alt="" className="w-16 h-16 rounded-full object-cover" />
        <ProfileForm key={`${me.name}|${me.nick}|${me.phone}`} me={me} />
        <div className="border-t border-line pt-4">
          <label className="label">비밀번호</label>
          {social
            ? <p className="text-[13px] text-mute">{SIGNUP_PROVIDER_LABELS[me.signupProvider] ?? me.signupProvider} 계정으로 가입해 비밀번호가 없어요</p>
            : <button type="button" onClick={() => setModal('password')} className="btn btn-line btn-sm">비밀번호 변경</button>}
        </div>
        <div className="pt-4">
          <button type="button" onClick={() => setModal('withdraw')} className="text-[12px] text-mute underline cursor-pointer">회원 탈퇴</button>
        </div>
      </div>
      <div className="mt-10 border border-line p-5 text-[13px]">
        <div className="font-bold mb-3">회원등급 <span className="text-mute font-normal">· 누적 구매확정 금액 기준 · 적립률은 모든 등급 {POINT_RATE * 100}%</span></div>
        <div className="grid grid-cols-3 gap-px bg-line">
          {GRADES.map((g) => (
            <div key={g.id} className={cx('p-3 text-center', g.id === me.grade ? 'bg-ink text-white' : 'bg-white')}>
              <GradeBadge grade={g.id} dark={g.id === me.grade} />
              <div className="font-bold mt-1.5">{g.label}</div>
              <div className="text-[11.5px] opacity-70 mt-1">{g.min ? `누적 ${comma(g.min / 10000)}만원 이상` : '가입 시'}</div>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-mute mt-2">내 누적 구매확정 금액 <b className="num text-ink">{won(me.spent)}</b></p>
      </div>
      {modal === 'password' && <PasswordModal email={me.email} onClose={() => setModal(null)} />}
      {modal === 'withdraw' && <WithdrawModal onClose={() => setModal(null)} onWithdrawn={onWithdrawn} />}
    </div>
  );
}

// 이름 · 닉네임 · 휴대폰 — 바뀐 항목만 보낸다. key 로 저장 후 새 값에서 다시 시작
function ProfileForm({ me }) {
  const [form, setForm] = useState({ name: me.name, nick: me.nick ?? '', phone: me.phone ?? '' });
  const [errors, setErrors] = useState({});
  const { mutate, isPending } = useUpdateMeMutation();

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((prev) => ({ ...prev, [e.target.name]: undefined }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(firstErrors(parsed.error.issues));
      return;
    }
    const request = toUpdateMeRequest(me, parsed.data);
    if (Object.keys(request).length === 0) {
      toast('바뀐 내용이 없어요');
      return;
    }
    mutate(request, {
      onSuccess: () => toast('회원정보가 수정되었어요'),
      onError: (err) => setErrors({ form: serverMessage(err) }),
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <div><label className="label" htmlFor="profile-email">이메일</label><input id="profile-email" className="field bg-cream text-mute" value={me.email} readOnly /></div>
      <div>
        <label className="label" htmlFor="profile-name">이름</label>
        <input id="profile-name" name="name" className="field" value={form.name} onChange={handleChange} />
        <FieldError message={errors.name} />
      </div>
      <div>
        <label className="label" htmlFor="profile-nick">닉네임 <span className="font-normal text-mute">(선택 · 비우면 삭제)</span></label>
        <input id="profile-nick" name="nick" className="field" value={form.nick} onChange={handleChange} />
        <FieldError message={errors.nick} />
      </div>
      <div>
        <label className="label" htmlFor="profile-phone">휴대폰</label>
        <input id="profile-phone" name="phone" type="tel" className="field" placeholder="010-0000-0000" value={form.phone} onChange={handleChange} />
        <FieldError message={errors.phone} />
      </div>
      {errors.form && <p role="alert" className="text-[13px] text-rust">{errors.form}</p>}
      <div className="flex justify-end">
        <button type="submit" className="btn btn-ink px-8" disabled={isPending}>{isPending ? '저장 중…' : '저장'}</button>
      </div>
    </form>
  );
}

// 비밀번호 변경 — 성공해도 로그인 상태는 그대로 (서버가 세션 · 토큰을 유지). 인증 액션이라 API 직접 호출 (컨벤션 4-6 예외)
function PasswordModal({ email, onClose }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((prev) => ({ ...prev, [e.target.name]: undefined }));
  };

  const handleSubmit = async () => {
    const parsed = passwordChangeSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(firstErrors(parsed.error.issues));
      return;
    }
    if (parsed.data.newPassword.toLowerCase() === email.toLowerCase()) {
      setErrors({ newPassword: '비밀번호는 이메일과 달라야 해요' });
      return;
    }
    setSubmitting(true);
    try {
      await changePassword({ currentPassword: parsed.data.currentPassword, newPassword: parsed.data.newPassword });
      toast('비밀번호를 변경했어요');
      onClose();
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'USER_PASSWORD_MISMATCH') setErrors({ currentPassword: serverMessage(err) });
      else if (code === 'AUTH_PASSWORD_POLICY_VIOLATION') setErrors({ newPassword: serverMessage(err) });
      else setErrors({ form: serverMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const fields = [
    ['currentPassword', '현재 비밀번호', 'current-password'],
    ['newPassword', '새 비밀번호', 'new-password', '영문 · 특수문자 포함 8자 이상'],
    ['newPasswordConfirm', '새 비밀번호 확인', 'new-password'],
  ];
  return (
    <Modal open onClose={onClose} title="비밀번호 변경" width={420}
      footer={<><button type="button" className="btn btn-line btn-sm" onClick={onClose}>취소</button><button type="button" className="btn btn-ink btn-sm" onClick={handleSubmit} disabled={submitting}>{submitting ? '변경 중…' : '변경'}</button></>}>
      <div className="space-y-3">
        {fields.map(([name, label, autoComplete, placeholder]) => (
          <div key={name}>
            <label className="label" htmlFor={`pw-${name}`}>{label}</label>
            <input id={`pw-${name}`} name={name} type="password" autoComplete={autoComplete} placeholder={placeholder} className="field"
              value={form[name]} onChange={handleChange} />
            <FieldError message={errors[name]} />
          </div>
        ))}
        {errors.form && <p role="alert" className="text-[13px] text-rust">{errors.form}</p>}
      </div>
    </Modal>
  );
}

// 탈퇴 — 되돌릴 수 없고 같은 이메일로 다시 가입할 수 없음. 판매자는 스토어 폐점 후 (409)
function WithdrawModal({ onClose, onWithdrawn }) {
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleWithdraw = async () => {
    setSubmitting(true);
    setError('');
    try {
      await withdraw();
      onWithdrawn?.();
    } catch (err) {
      setError(serverMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="회원 탈퇴" width={420}
      footer={<><button type="button" className="btn btn-line btn-sm" onClick={onClose}>취소</button><button type="button" className="btn btn-ink btn-sm" onClick={handleWithdraw} disabled={!agreed || submitting}>{submitting ? '처리 중…' : '탈퇴하기'}</button></>}>
      <ul className="space-y-1.5 text-[13px] text-ink-2 list-disc pl-4">
        <li>탈퇴하면 되돌릴 수 없고, <b className="text-ink">같은 이메일로 다시 가입할 수 없어요.</b></li>
        <li>남은 포인트는 사라져요.</li>
        <li>판매자는 스토어를 폐점한 뒤에 탈퇴할 수 있어요.</li>
      </ul>
      <label className="mt-4 flex items-center gap-2 text-[13px] cursor-pointer">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        위 내용을 확인했어요
      </label>
      {error && <p role="alert" className="mt-3 text-[13px] text-rust">{error}</p>}
    </Modal>
  );
}
