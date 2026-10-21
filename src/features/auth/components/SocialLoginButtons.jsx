// 소셜 로그인 버튼 — 담당 이경석
import { SOCIAL_PROVIDERS } from '@/features/auth/constants';
import { socialLoginUrl } from '@/features/auth/api/authApi';

export default function SocialLoginButtons() {
  return (
    <div className="mt-8">
      <div className="flex items-center gap-3 text-[12px] text-mute">
        <div className="h-px flex-1 bg-line" />간편 로그인<div className="h-px flex-1 bg-line" />
      </div>
      <div className="mt-4 space-y-2">
        {SOCIAL_PROVIDERS.map((p) => (
          // 링크 이동 — 백엔드가 302 로 Keycloak · 제공자 로그인 화면으로 보낸다
          <a key={p.id} href={socialLoginUrl(p.id)} className="btn btn-line btn-lg w-full">{p.label}</a>
        ))}
      </div>
    </div>
  );
}
