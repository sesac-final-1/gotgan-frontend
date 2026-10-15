import { Link, NavLink, Outlet } from 'react-router';
import { GradeBadge } from '@/shared/components/ui';
import { cx, won, comma } from '@/shared/utils/format';

const MENU = [
  ['쇼핑', [['/mypage/orders', '주문 · 배송'], ['/mypage/claims', '취소 · 반품 · 교환'], ['/cart', '장바구니']]],
  ['활동', [['/mypage/reviews', '리뷰 관리'], ['/mypage/qna', '상품 문의']]],
  ['혜택', [['/mypage/points', '포인트']]],
  ['내 정보', [['/mypage/profile', '회원정보 수정'], ['/mypage/addresses', '배송지 관리']]],
];

// 마이페이지 각 화면의 제목줄 (목업 H)
export function MyPageHead({ children, right }) {
  return <div className="flex items-end justify-between border-b border-ink pb-3 mb-5"><h1 className="text-[20px] font-bold">{children}</h1>{right}</div>;
}

// 마이페이지 레이아웃 — 데이터(회원 · 등급 · 포인트 · 건수)는 props 로 받는다 (shared 는 features 에 의존하지 않음, 연결은 pages/mypage/MyPageRoot.jsx)
// me: 회원 정보 · gradeLabel: 등급 이름 · next: 다음 등급 { id, min } 또는 null
export default function MyPageLayout({ me, gradeLabel = '', next = null, pointBalance = 0, todoReviews = 0, openClaims = 0 }) {
  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-6 pt-8">
      {/* 상단 요약 */}
      <div className="bg-ink text-white grid md:grid-cols-[1fr_auto]">
        <div className="p-6 md:p-8 flex items-center gap-5">
          {me && (
            <>
              <img src={me.avatar} alt="" className="w-16 h-16 rounded-full object-cover" />
              <div>
                <div className="flex items-center gap-2 text-[13px] text-white/60"><GradeBadge grade={me.grade} dark /> {gradeLabel} 회원 · {next ? `${next.id}까지 ${won(next.min - me.spent)}` : '최고 등급'}</div>
                <div className="text-[22px] font-bold mt-0.5">{me.name}님, 반가워요</div>
                <div className="mt-2 h-1 w-56 bg-white/15"><div className="h-full bg-[#e6c06a]" style={{ width: `${next ? (me.spent / next.min) * 100 : 100}%` }} /></div>
              </div>
            </>
          )}
        </div>
        <div className="grid grid-cols-3 border-t md:border-t-0 md:border-l border-white/10">
          {[['포인트', `${comma(pointBalance)}P`, '/mypage/points'], ['작성 가능 리뷰', `${todoReviews}건`, '/mypage/reviews'], ['진행 중 클레임', `${openClaims}건`, '/mypage/claims']].map(([k, v, to], i) => (
            <Link key={k} to={to} className={cx('px-6 md:px-9 py-5 md:py-8 text-center hover:bg-white/5', i && 'border-l border-white/10')}>
              <div className="text-[12px] text-white/60">{k}</div>
              <div className="text-[20px] font-bold mt-1 num">{v}</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-[200px_1fr] gap-6 lg:gap-10 mt-8">
        <aside className="min-w-0">
          <h2 className="text-[22px] font-bold mb-4 hidden lg:block">마이페이지</h2>
          <nav className="flex lg:block gap-4 overflow-x-auto no-scrollbar border-b lg:border-0 border-line pb-3 lg:pb-0">
            {MENU.map(([g, items]) => (
              <div key={g} className="lg:mb-6 flex lg:block gap-4 shrink-0">
                <div className="hidden lg:block text-[12px] font-bold text-mute mb-2">{g}</div>
                {items.map(([to, l]) => (
                  <NavLink key={to} to={to} className={({ isActive }) => cx('block lg:py-1.5 text-[14px] whitespace-nowrap', isActive ? 'font-bold text-ink lg:underline underline-offset-4' : 'text-ink-2 hover:text-ink')}>{l}</NavLink>
                ))}
              </div>
            ))}
          </nav>
        </aside>
        <div className="min-w-0"><Outlet /></div>
      </div>
    </div>
  );
}
