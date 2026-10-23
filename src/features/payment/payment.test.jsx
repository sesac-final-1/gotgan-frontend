import { renderHook, waitFor, act } from '@testing-library/react';
import * as PortOne from '@portone/browser-sdk/v2';
import { createWrapper } from '@/test/queryWrapper';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { queryKeys } from '@/shared/api/queryKeys';
import { readPaymentRedirect, requestCardPayment, toPaymentResult } from '@/features/payment/portone';
import { finishRedirectPayment, payOrder, paymentRedirectUrl } from '@/features/payment/payOrder';
import { usePayOrderMutation } from '@/features/payment/hooks/usePayOrderMutation';
import { useRedirectPaymentQuery } from '@/features/payment/hooks/useRedirectPaymentQuery';

vi.mock('@portone/browser-sdk/v2', () => ({ requestPayment: vi.fn() }));

afterEach(() => vi.restoreAllMocks());
beforeEach(() => PortOne.requestPayment.mockReset());

// 주문 생성 응답 (backend OrderCreateResponse)
const CREATED = { orderNo: '20261023-000001', status: 'PENDING', payAmt: 64400, portonePaymentId: 'pay-20261023-000001', orderName: '유기농 사과 외 1건' };
const PAID = { orderNo: CREATED.orderNo, status: 'PAID', payAmt: 64400 };
const httpError = (status, code) => Object.assign(new Error(code), { response: { status, data: { code, message: `서버 메시지 ${code}` } } });

describe('toPaymentResult — 결제창 응답 · 리다이렉트 쿼리 정리', () => {
  it('code 없음 = 결제창 끝남(APPROVED), 사용자 취소 코드 = CANCELLED, 그 밖은 FAILED + PG 메시지 우선', () => {
    expect(toPaymentResult({ paymentId: 'p' }).status).toBe('APPROVED');
    expect(toPaymentResult({ code: 'FAILURE_TYPE_PG', pgCode: 'PAY_PROCESS_CANCELED' }).status).toBe('CANCELLED');
    expect(toPaymentResult({ code: 'FAILURE_TYPE_PG', pgCode: 'REJECT_CARD_COMPANY', pgMessage: '카드사 거절', message: 'x' }))
      .toEqual({ status: 'FAILED', message: '카드사 거절' });
    expect(toPaymentResult({ code: 'PGProviderError', message: '오류' }).message).toBe('오류');
  });
});

describe('requestCardPayment — 포트원 SDK 호출', () => {
  it('주문 생성 응답 그대로 카드 · KRW 결제창, 응답을 결과로', async () => {
    PortOne.requestPayment.mockResolvedValue({ transactionType: 'PAYMENT', txId: 't', paymentId: CREATED.portonePaymentId });

    const result = await requestCardPayment({ ...CREATED, redirectUrl: 'https://x/order/complete' });

    expect(PortOne.requestPayment).toHaveBeenCalledWith(expect.objectContaining({
      paymentId: 'pay-20261023-000001', orderName: '유기농 사과 외 1건', totalAmount: 64400,
      currency: 'KRW', payMethod: 'CARD', redirectUrl: 'https://x/order/complete',
    }));
    expect(result.status).toBe('APPROVED');
  });

  it('리다이렉트 방식(undefined) → null, 결제창을 띄우기 전 예외 → FAILED', async () => {
    PortOne.requestPayment.mockResolvedValueOnce(undefined);
    expect(await requestCardPayment(CREATED)).toBeNull();

    PortOne.requestPayment.mockRejectedValueOnce(new Error('load failed'));
    expect((await requestCardPayment(CREATED)).status).toBe('FAILED');
  });
});

describe('readPaymentRedirect — redirectUrl 쿼리', () => {
  it('paymentId 없으면 null, 있으면 code 로 결과', () => {
    expect(readPaymentRedirect('?orderNo=1')).toBeNull();
    expect(readPaymentRedirect('?orderNo=1&paymentId=pay-1').status).toBe('APPROVED');
    expect(readPaymentRedirect('?paymentId=pay-1&code=FAILURE_TYPE_PG&pgCode=PAY_PROCESS_CANCELED').status).toBe('CANCELLED');
  });

  it('돌아올 주소는 주문 완료 화면 + 주문번호', () => {
    expect(paymentRedirectUrl('20261023-000001')).toBe(`${window.location.origin}/order/complete?orderNo=20261023-000001`);
  });
});

describe('payOrder — 결제창 → 결제 확인', () => {
  it('결제창 끝나면 결제 확인 API(주문번호만) → PAID', async () => {
    PortOne.requestPayment.mockResolvedValue({ paymentId: CREATED.portonePaymentId });
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: PAID } });

    expect(await payOrder(CREATED)).toEqual({ status: 'PAID', orderNo: CREATED.orderNo, payAmt: 64400, message: '' });
    expect(post).toHaveBeenCalledWith('/api/orders/20261023-000001/payment/confirm');
  });

  it('0원(전액 포인트)은 결제창 · 결제 확인 없이 PAID', async () => {
    const post = vi.spyOn(axiosInstance, 'post');

    expect((await payOrder({ ...CREATED, payAmt: 0, portonePaymentId: null, status: 'PAID' })).status).toBe('PAID');
    expect(PortOne.requestPayment).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('결제창 취소 · 실패 · 리다이렉트는 결제 확인을 부르지 않음', async () => {
    const post = vi.spyOn(axiosInstance, 'post');
    PortOne.requestPayment.mockResolvedValueOnce({ code: 'FAILURE_TYPE_PG', pgCode: 'PAY_PROCESS_CANCELED' });
    expect((await payOrder(CREATED)).status).toBe('CANCELLED');
    PortOne.requestPayment.mockResolvedValueOnce({ code: 'FAILURE_TYPE_PG', pgMessage: '한도 초과' });
    expect(await payOrder(CREATED)).toMatchObject({ status: 'FAILED', message: '한도 초과', orderNo: CREATED.orderNo });
    PortOne.requestPayment.mockResolvedValueOnce(undefined);
    expect((await payOrder(CREATED)).status).toBe('REDIRECTED');
    expect(post).not.toHaveBeenCalled();
  });

  it('결제 확인 응답 — 409 미결제 · 502 · 네트워크 오류는 PENDING, 결제 실패 · 그 밖의 4xx 는 FAILED', async () => {
    PortOne.requestPayment.mockResolvedValue({ paymentId: CREATED.portonePaymentId });
    const post = vi.spyOn(axiosInstance, 'post');
    const statusOf = async (error) => { post.mockRejectedValueOnce(error); return payOrder(CREATED); };

    expect((await statusOf(httpError(409, 'ORDER_PAYMENT_NOT_COMPLETED'))).status).toBe('PENDING');
    expect((await statusOf(httpError(502, 'EXTERNAL_API_ERROR'))).status).toBe('PENDING');
    expect((await statusOf(new Error('Network Error'))).status).toBe('PENDING');
    expect(await statusOf(httpError(409, 'ORDER_PAYMENT_FAILED'))).toMatchObject({ status: 'FAILED', message: expect.stringContaining('주문이 취소') });
    expect(await statusOf(httpError(409, 'ORDER_INVALID_STATUS'))).toMatchObject({ status: 'FAILED', message: '서버 메시지 ORDER_INVALID_STATUS' });
  });
});

describe('finishRedirectPayment — 리다이렉트로 돌아온 뒤', () => {
  it('결제 결과 쿼리 없으면 null, 성공이면 결제 확인, 취소면 확인 없이 CANCELLED', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: PAID } });

    expect(await finishRedirectPayment(CREATED.orderNo, '?orderNo=20261023-000001')).toBeNull();
    expect((await finishRedirectPayment(CREATED.orderNo, '?paymentId=pay-1&code=FAILURE_TYPE_PG&pgCode=PAY_PROCESS_CANCELED')).status).toBe('CANCELLED');
    expect(post).not.toHaveBeenCalled();
    expect((await finishRedirectPayment(CREATED.orderNo, '?orderNo=20261023-000001&paymentId=pay-1')).status).toBe('PAID');
    expect(post).toHaveBeenCalledTimes(1);
  });
});

describe('훅', () => {
  it('usePayOrderMutation — 결과 반환 후 내 주문 목록 무효화', async () => {
    PortOne.requestPayment.mockResolvedValue({ paymentId: CREATED.portonePaymentId });
    vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: PAID } });
    const { client, Wrapper } = createWrapper();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => usePayOrderMutation(), { wrapper: Wrapper });

    let r;
    await act(async () => { r = await result.current.mutateAsync(CREATED); });

    expect(r.status).toBe('PAID');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.order.my() });
  });

  it('useRedirectPaymentQuery — 주문번호 없으면 부르지 않고, 있으면 결제 확인 결과', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: PAID } });
    const { Wrapper } = createWrapper();

    const idle = renderHook(() => useRedirectPaymentQuery(null, '?paymentId=pay-1'), { wrapper: Wrapper });
    expect(idle.result.current.fetchStatus).toBe('idle');

    const { result } = renderHook(() => useRedirectPaymentQuery(CREATED.orderNo, '?paymentId=pay-1'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data?.status).toBe('PAID'));
    expect(post).toHaveBeenCalledTimes(1);
  });
});
