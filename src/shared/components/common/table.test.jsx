import { render, screen, fireEvent } from '@testing-library/react';
import { BlockPager } from '@/shared/components/common/BlockPager';
import { DataTable } from '@/shared/components/common/DataTable';
import { useClientTable } from '@/shared/hooks/useClientTable';

describe('BlockPager', () => {
  it('10페이지씩 묶어 보여 주고 >> 는 다음 묶음 첫 페이지(11)로', () => {
    const onPage = vi.fn();
    render(<BlockPager pageIndex={9} pageCount={25} onPage={onPage} />);
    expect(screen.getByRole('button', { name: '10' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('button', { name: '11' })).toBeNull();
    fireEvent.click(screen.getByLabelText('다음 10페이지'));
    expect(onPage).toHaveBeenCalledWith(10); // 0부터 → 11페이지
    fireEvent.click(screen.getByLabelText('다음 페이지'));
    expect(onPage).toHaveBeenLastCalledWith(10);
  });

  it('한 페이지뿐이면 그리지 않는다', () => {
    const { container } = render(<BlockPager pageIndex={0} pageCount={1} onPage={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});

const ROWS = Array.from({ length: 45 }, (_, i) => ({ id: i + 1, name: i % 2 ? `리넨 셔츠 ${i + 1}` : `울 코트 ${i + 1}`, price: (i + 1) * 1000 }));
const COLUMNS = [
  { accessorKey: 'name', header: '상품명' },
  { accessorKey: 'price', header: '가격' },
];
function Harness() {
  const { table, globalFilter, setGlobalFilter } = useClientTable({ data: ROWS, columns: COLUMNS, pageSize: 10 });
  return (
    <>
      <input aria-label="검색" value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} />
      <DataTable table={table} />
    </>
  );
}

describe('useClientTable + DataTable', () => {
  it('받아온 목록 안에서 검색 · 정렬 · 페이징', () => {
    render(<Harness />);
    expect(screen.getAllByRole('row')).toHaveLength(11); // 헤더 1 + 10행
    expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument(); // 45건 / 10 = 5페이지

    fireEvent.change(screen.getByLabelText('검색'), { target: { value: '리넨' } });
    expect(screen.getAllByText(/리넨 셔츠/)).toHaveLength(10);
    expect(screen.queryByText(/울 코트/)).toBeNull();

    const firstPrice = () => screen.getAllByRole('row')[1].querySelectorAll('td')[1].textContent;
    fireEvent.click(screen.getByRole('button', { name: /가격/ })); // 오름차순
    expect(firstPrice()).toBe('2000'); // 리넨(홀수 i) 중 가장 싼 것
    fireEvent.click(screen.getByRole('button', { name: /가격/ })); // 내림차순
    expect(firstPrice()).toBe('44000');
  });

  it('검색 결과가 없으면 빈 상태 행', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('검색'), { target: { value: '없는상품' } });
    expect(screen.getByText('조건에 맞는 항목이 없어요')).toBeInTheDocument();
  });
});
