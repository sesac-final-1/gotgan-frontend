import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import ShopLayout from '@/shared/layouts/ShopLayout';

// 모바일 드로어 — 같은 /products 에서 카테고리(?cat=)만 바뀌어도 닫힌다 (박지연 10/29 확인 요청)
const CATEGORIES = [
  { id: 3, name: '패션의류', en: 'Apparel', children: [{ id: 301, name: '셔츠' }] },
  { id: 1, name: '식품', en: 'Food', children: [{ id: 101, name: '과일' }] },
];

describe('쇼핑몰 레이아웃 — 모바일 드로어', () => {
  it('쿼리만 바뀌는 카테고리 이동에도 드로어를 닫는다', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    render(<MemoryRouter initialEntries={['/products?cat=3']}><ShopLayout categories={CATEGORIES} /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: '메뉴' }));
    const drawerLink = screen.getByRole('link', { name: '식품Food' }); // 드로어 항목은 이름 + 영문
    expect(drawerLink).toHaveAttribute('href', '/products?cat=1');
    fireEvent.click(drawerLink);

    await waitFor(() => expect(screen.queryByRole('link', { name: '식품Food' })).not.toBeInTheDocument());
    vi.restoreAllMocks();
  });
});

describe('쇼핑몰 레이아웃 — 드로어 배경', () => {
  it('배경(버튼)을 누르면 드로어를 닫는다', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    render(<MemoryRouter initialEntries={['/']}><ShopLayout categories={CATEGORIES} /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: '메뉴' }));
    expect(screen.getByRole('link', { name: '식품Food' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '메뉴 닫기' }));

    expect(screen.queryByRole('link', { name: '식품Food' })).not.toBeInTheDocument();
    vi.restoreAllMocks();
  });
});

describe('쇼핑몰 푸터 링크', () => {
  it('실제 화면으로 가는 링크만 — 랭킹 · 1:1 문의는 없다', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    render(<MemoryRouter initialEntries={['/']}><ShopLayout categories={CATEGORIES} /></MemoryRouter>);
    const footer = within(screen.getByRole('contentinfo'));
    const hrefs = {
      카테고리: '/products', 신상: '/products?sort=new', '스토어 둘러보기': '/stores',
      공지사항: '/notice', '자주 묻는 질문': '/faq', 고객센터: '/help',
      '입점 신청': '/seller/apply', 판매자센터: '/seller', '수수료 안내': '/fees', '판매자 이용약관': '/terms/seller',
    };
    Object.entries(hrefs).forEach(([name, href]) => expect(footer.getByRole('link', { name })).toHaveAttribute('href', href));
    expect(footer.queryByText('랭킹')).toBeNull();
    expect(footer.queryByText('1:1 문의')).toBeNull();
    expect(footer.getByText(/팀 프로젝트 시연용 사이트이며 실제 거래가 이루어지지 않습니다/)).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
