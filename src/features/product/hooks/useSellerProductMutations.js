import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { updateSellerProductStatus, deleteSellerProducts, saveSellerProduct } from '@/features/product/api/productApi';

// 판매자 상품 변경 — 담당 박지연. 끝나면(일부 실패 포함) 판매자 상품 목록 · 상세를 다시 불러온다

function useSellerProductMutation(mutationFn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.product.seller() }),
  });
}

// { productIds, status: '판매중' | '판매중지' } → { success[], failed[] }
export const useUpdateSellerProductStatusMutation = () => useSellerProductMutation(updateSellerProductStatus);

// productIds → { success[], failed[] }
export const useDeleteSellerProductsMutation = () => useSellerProductMutation(deleteSellerProducts);

// { productId?, request } — productId 가 있으면 수정(PUT), 없으면 등록(POST) → 12절 상세
export const useSaveSellerProductMutation = () => useSellerProductMutation(saveSellerProduct);
