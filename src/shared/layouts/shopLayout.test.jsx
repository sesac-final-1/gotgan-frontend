import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
