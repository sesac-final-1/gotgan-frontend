import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import ConsoleLayout from '@/shared/layouts/ConsoleLayout';

// 콘솔 상단 로고 → 쇼핑몰 메인 (QA 2차 11/6)
describe('콘솔 레이아웃 — 상단 로고', () => {
  it.each(['seller', 'admin'])('%s 콘솔 로고는 쇼핑몰 메인으로 간다', (kind) => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    render(<MemoryRouter initialEntries={[`/${kind}`]}>
      <ConsoleLayout kind={kind} groups={[]} account={{ name: '시험', role: '역할' }} badge="배지" />
    </MemoryRouter>);
    expect(screen.getByRole('link', { name: '곳간 쇼핑몰 메인으로' })).toHaveAttribute('href', '/');
  });
});
