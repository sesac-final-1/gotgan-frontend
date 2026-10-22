// 소셜 로그인 버튼 — 담당 이경석. 모양 · 심볼은 각 개발자 사이트 가이드 (constants.js SOCIAL_PROVIDERS)
import { SOCIAL_PROVIDERS } from '@/features/auth/constants';
import { socialLoginUrl } from '@/features/auth/api/authApi';
import { cx } from '@/shared/utils/format';

export default function SocialLoginButtons() {
  return (
    <div className="mt-8">
      <div className="flex items-center gap-3 text-[12px] text-mute">
        <div className="h-px flex-1 bg-line" />간편 로그인<div className="h-px flex-1 bg-line" />
      </div>
      <div className="mt-4 space-y-2">
        {SOCIAL_PROVIDERS.map((p) => (
          // 링크 이동 — 백엔드가 302 로 Keycloak · 제공자 로그인 화면으로 보낸다
          p.image ? (
            // 제공자가 버튼 이미지째 주는 경우(네이버) — 비율 그대로, 늘리지 않음
            <a key={p.id} href={socialLoginUrl(p.id)} className="block">
              <img src={p.image} alt={p.label} className="block h-auto w-full" />
            </a>
          ) : (
            <a key={p.id} href={socialLoginUrl(p.id)}
              className={cx('relative flex h-12 w-full items-center justify-center text-[15px] font-medium', p.className)}>
              {p.icon && <img src={p.icon} alt="" aria-hidden="true" className="absolute left-4 h-[18px] w-[18px]" />}
              {p.label}
            </a>
          )
        ))}
      </div>
    </div>
  );
}
