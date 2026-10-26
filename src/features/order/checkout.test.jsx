import { renderHook, act } from '@testing-library/react';
import { createWrapper } from '@/test/queryWrapper';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { queryKeys } from '@/shared/api/queryKeys';
import { createOrder } from '@/features/order/api/orderApi';
import { useCreateOrderMutation } from '@/features/order/hooks/useCreateOrderMutation';
import { toOrderRequest } from '@/features/order/utils/orderRequest';

afterEach(() => vi.restoreAllMocks());

// 배송지 응답 (user Address) · 장바구니 줄 · 주문 생성 응답 (backend OrderCreateResponse)
const HOME = { id: 10, label: '집', name: '김곳간', phone: '010-1234-5678', zip: '06236', addr: '서울 강남구 테헤란로 152', detail: '21층', main: true };
const LINES = [{ key: 'p402|S', productOptionId: 11, qty: 2, unit: 9000 }, { key: 'p702|하루', productOptionId: 12, qty: 1, unit: 5000 }];
const CREATED = { orderNo: '20261026-000001', status: 'PENDING', payAmt: 21000, portonePaymentId: 'pay-20261026-000001', orderName: '상품 11 외 1건' };

describe('toOrderRequest — 주문서 → OrderCreateRequest', () => {
  it('옵션 · 수량 · 배송지 스냅샷 · 사용 포인트만, 금액은 보내지 않는다', () => {
    expect(toOrderRequest({ lines: LINES, address: HOME, memo: ' 문 앞에 놓아주세요 ', point: 2000 })).toEqual({
      items: [{ productOptionId: 11, quantity: 2 }, { productOptionId: 12, quantity: 1 }],
      receiverName: '김곳간', receiverPhone: '010-1234-5678', zipcode: '06236',
      address1: '서울 강남구 테헤란로 152', address2: '21층', deliveryMemo: '문 앞에 놓아주세요', usePoint: 2000,
    });
  });

  it('상세 주소 · 요청사항이 비면 null', () => {
    const r = toOrderRequest({ lines: LINES, address: { ...HOME, detail: null }, memo: '  ', point: 0 });
    expect(r.address2).toBeNull();
    expect(r.deliveryMemo).toBeNull();
    expect(toOrderRequest({ lines: LINES, address: HOME, memo: undefined, point: 0 }).deliveryMemo).toBeNull();
  });
});

describe('createOrder · useCreateOrderMutation', () => {
  it('POST /api/orders → 응답 data, 성공하면 포인트 · 내 주문을 다시 불러온다', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: CREATED } });
    const { client, Wrapper } = createWrapper();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useCreateOrderMutation(), { wrapper: Wrapper });

    let created;
    await act(async () => { created = await result.current.mutateAsync({ items: [] }); });

    expect(created).toEqual(CREATED);
    expect(post).toHaveBeenCalledWith('/api/orders', { items: [] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.user.points() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.order.my() });
  });

  it('실패(재고 부족 등)는 그대로 던진다 — 화면이 서버 메시지를 토스트', async () => {
    const error = Object.assign(new Error('409'), { response: { status: 409, data: { code: 'ORDER_OUT_OF_STOCK', message: '재고가 부족합니다.' } } });
    vi.spyOn(axiosInstance, 'post').mockRejectedValue(error);

    await expect(createOrder({ items: [] })).rejects.toBe(error);
  });
});
