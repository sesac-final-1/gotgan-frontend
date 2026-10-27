import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { addCartItems, checkCartItems, fetchCart, removeCartItems, updateCartItem } from '@/features/order/api/orderApi';
import { cartLines, clampQty, patchLines } from '@/features/order/utils/cartView';
import { toast } from '@/shared/stores/toastStore';

const errorMessage = (err, fallback) => err?.response?.data?.message ?? fallback;

// 장바구니 — 담당 이경석 (GET /api/carts + 담기 · 수량 · 선택 · 삭제). 원본은 서버(MySQL, Redis 캐시)라 새로고침 · 다른 기기에서도 같다.
// 로그인 전에는 부르지 않는다 (쇼핑몰 헤더 배지가 모든 화면에서 이 훅을 쓴다).
// 수량 · 선택은 낙관적 업데이트 — 누르는 즉시 화면에 반영하고, 저장이 실패하면 되돌린 뒤 서버 값(금액 · 배송비)으로 다시 맞춘다.
export function useCart() {
  const loggedIn = useAuthStore((s) => Boolean(s.user));
  const queryClient = useQueryClient();
  const key = queryKeys.order.cart();
  const query = useQuery({ queryKey: key, queryFn: () => fetchCart(), enabled: loggedIn });
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  // 한 줄이면 줄 수정(수량 · 선택), 여러 줄 · 전체(ids null)면 선택 한꺼번에
  const optimistic = useMutation({
    mutationFn: ({ ids, change }) => (ids?.length === 1 ? updateCartItem(ids[0], change) : checkCartItems(change.checked, ids ?? undefined)),
    onMutate: async ({ ids, change }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData(key);
      queryClient.setQueryData(key, patchLines(prev, ids, change));
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      queryClient.setQueryData(key, ctx?.prev);
      toast(errorMessage(err, '장바구니를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.'));
    },
    onSettled: refresh,
  });
  const add = useMutation({ mutationFn: addCartItems, onSettled: refresh });
  const remove = useMutation({ mutationFn: removeCartItems, onSettled: refresh });

  const cart = query.data;
  return {
    cart,
    lines: cartLines(cart),
    isLoading: query.isLoading,
    isError: query.isError,
    cartCount: cart?.cartCount ?? 0,
    // items: [{ productOptionId, quantity }] → 성공하면 true (실패는 서버 메시지 토스트)
    addToCart: async (items) => {
      try { await add.mutateAsync(items); return true; } catch (err) { toast(errorMessage(err, '장바구니에 담지 못했어요.')); return false; }
    },
    setQty: (productOptionId, qty) => optimistic.mutate({ ids: [productOptionId], change: { quantity: clampQty(qty) } }),
    toggleLine: (productOptionId, checked) => optimistic.mutate({ ids: [productOptionId], change: { checked } }),
    toggleAll: (checked) => optimistic.mutate({ ids: null, change: { checked } }),
    removeLines: async (productOptionIds) => {
      try { await remove.mutateAsync(productOptionIds); return true; } catch (err) { toast(errorMessage(err, '삭제하지 못했어요.')); return false; }
    },
    refresh,
  };
}
