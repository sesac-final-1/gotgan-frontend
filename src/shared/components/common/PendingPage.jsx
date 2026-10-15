import { useLocation } from 'react-router';

// 아직 이식하지 않은 화면 — F4(화면 이식)에서 각 페이지로 교체
export default function PendingPage() {
  const { pathname } = useLocation();
  return (
    <div className="p-10 text-center text-mute">
      <p className="text-[15px] font-semibold text-ink">화면 이식 중</p>
      <p className="mt-1 num text-[12px]">{pathname}</p>
    </div>
  );
}
