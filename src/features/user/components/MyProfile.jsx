// 마이페이지 회원정보 수정 — 담당 이경석
import { Checkbox, GradeBadge } from '@/shared/components/ui';
import { MyPageHead } from '@/shared/layouts/MyPageLayout';
import { useMeQuery } from '@/features/user/hooks/useMeQuery';
import { GRADES, POINT_RATE } from '@/features/user/constants';
import { toast } from '@/shared/stores/toastStore';
import { cx, won, comma } from '@/shared/utils/format';

export default function MyProfile() {
  const { data: me, isLoading } = useMeQuery();
  if (isLoading) return <p className="text-mute py-10 text-center">불러오는 중…</p>;
  if (!me) return <p className="text-mute py-10 text-center">회원 정보를 불러오지 못했어요</p>;
  const save = () => {
    // TODO(이경석): useUpdateMeMutation
    toast('회원정보가 수정되었어요');
  };
  return (
    <div>
      <MyPageHead>회원정보 수정</MyPageHead>
      <div className="max-w-[520px] space-y-4">
        <div className="flex items-center gap-4"><img src={me.avatar} alt="" className="w-16 h-16 rounded-full object-cover" /><button className="btn btn-line btn-sm">프로필 사진 변경</button></div>
        {[['이메일', me.email, true], ['이름', me.name], ['닉네임', me.nick], ['휴대폰', me.phone]].map(([k, v, ro]) => (
          <div key={k}><label className="label">{k}</label><input className={cx('field', ro && 'bg-cream text-mute')} defaultValue={v} readOnly={ro} /></div>
        ))}
        <div><label className="label">비밀번호</label><button className="btn btn-line btn-sm">비밀번호 변경</button></div>
        <div className="border-t border-line pt-4 space-y-2 text-[13px]">
          <div className="font-semibold">알림 수신 설정</div>
          <Checkbox checked label="주문/배송 알림 (필수)" />
          <Checkbox checked label="관심 스토어 신상품 알림" />
          <Checkbox checked={false} label="마케팅 정보 수신 (이메일 · 문자)" />
        </div>
        <div className="flex justify-between pt-4">
          <button className="text-[12px] text-mute underline">회원 탈퇴</button>
          <button onClick={save} className="btn btn-ink px-8">저장</button>
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
    </div>
  );
}
