import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import NoticePage from '@/pages/shop/NoticePage';
import FaqPage from '@/pages/shop/FaqPage';
import FeesPage from '@/pages/shop/FeesPage';
import SellerTermsPage from '@/pages/shop/SellerTermsPage';

// 푸터 정책 화면 4개 — 쇼핑몰 틀 안 공개 경로 (정적 데이터, 푸터 링크는 shared/layouts/shopLayout.test.jsx)
function renderAt(path) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="notice" element={<NoticePage />} />
        <Route path="faq" element={<FaqPage />} />
        <Route path="fees" element={<FeesPage />} />
        <Route path="terms/seller" element={<SellerTermsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('푸터 정책 화면', () => {
  it.each([
    ['/notice', '공지사항'],
    ['/faq', '자주 묻는 질문'],
    ['/fees', '수수료 안내'],
    ['/terms/seller', '판매자 이용약관'],
  ])('%s → 제목 "%s"', (path, title) => {
    renderAt(path);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
  });

  it('공지사항은 눌러야 본문이 펼쳐진다', () => {
    renderAt('/notice');
    expect(screen.queryByText(/실제 출금은 일어나지 않으며/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /포트원 테스트 결제로/ }));
    expect(screen.getByText(/실제 출금은 일어나지 않으며/)).toBeInTheDocument();
  });

  it('FAQ — 구매자 탭이 기본, 판매자 탭으로 바꾸면 판매자 문항', () => {
    renderAt('/faq');
    expect(screen.getByRole('tab', { name: '구매자' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: /반품 배송비는 얼마인가요/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '판매자' }));
    expect(screen.getByRole('tab', { name: '판매자' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('button', { name: /반품 배송비는 얼마인가요/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /어떤 서류가 필요한가요/ }));
    expect(screen.getByText(/사업자등록증 · 통신판매업 신고증/)).toBeInTheDocument();
  });

  it('수수료 안내 — 카테고리 요율 표와 계산 예시(원 단위 내림)', () => {
    renderAt('/fees');
    const table = screen.getByRole('table');
    expect(within(table).getByText('패션의류')).toBeInTheDocument();
    expect(within(table).getAllByText('2.2%')).toHaveLength(6);
    expect(screen.getByText('26,640원')).toBeInTheDocument(); // 30,000 − 2,700 − 660
    expect(screen.getByText(/변경은 공지 후 적용/)).toBeInTheDocument();
  });

  it('판매자 이용약관 — 시연용 안내와 조항', () => {
    renderAt('/terms/seller');
    expect(screen.getByText('팀 프로젝트 시연용 문서로 법적 효력이 없습니다.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '제1조 (목적)' })).toBeInTheDocument();
  });
});
