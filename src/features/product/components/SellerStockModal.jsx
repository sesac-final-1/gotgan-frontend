// 판매자 재고 수정 모달 — 담당 박지연. 계약 backend docs/api/product.md 14절
import { useState } from 'react';
import { Modal } from '@/shared/components/ui';
import { useSellerProductQuery } from '@/features/product/hooks/useSellerProductQuery';
import { useUpdateSellerProductStocksMutation } from '@/features/product/hooks/useSellerProductMutations';
import { stockChanges, optionLabel } from '@/features/product/productForm';
import { toast } from '@/shared/stores/toastStore';

// productId 가 있으면 열림. 열 때 상세(12절)로 옵션별 지금 재고를 읽고, 그 값을 seenStock 으로 보낸다
export default function SellerStockModal({ productId, onClose }) {
  const { data: p, isLoading, isError, dataUpdatedAt } = useSellerProductQuery(productId);
  return (
    <Modal open={Boolean(productId)} onClose={onClose} title="재고 수정" width={480}>
      {isLoading && <p className="text-mute text-center py-6">불러오는 중…</p>}
      {isError && <p className="text-mute text-center py-6">상품을 불러오지 못했어요</p>}
      {/* key: 다시 읽으면(409 뒤 등) 입력값을 최신 재고로 초기화 */}
      {p && <StockBody key={dataUpdatedAt} p={p} onClose={onClose} />}
    </Modal>
  );
}

function StockBody({ p, onClose }) {
  const [edited, setEdited] = useState({});
  const save = useUpdateSellerProductStocksMutation();
  const submit = () => {
    const items = stockChanges(p.options, edited);
    if (!items.length) return toast('바뀐 재고가 없어요');
    save.mutate({ productId: p.id, items }, {
      onSuccess: () => { toast('재고를 저장했어요'); onClose(); },
      onError: (err) => toast(err.response?.data?.code === 'STOCK_CHANGED'
        ? '그 사이 주문이 들어와 재고가 바뀌었어요. 최신 재고를 다시 불러왔어요'
        : err.response?.data?.message ?? '저장하지 못했어요. 잠시 후 다시 시도해 주세요.'),
    });
  };
  return (
    <div>
      <p className="text-[13px] font-medium mb-3">{p.name}</p>
      <table className="tbl">
        <thead><tr><th>옵션</th><th className="w-24 text-right">지금 재고</th><th className="w-28">바꿀 재고</th></tr></thead>
        <tbody>
          {p.options.map((o) => (
            <tr key={o.productOptionId}>
              <td>{optionLabel(o)}</td>
              <td className="text-right num">{o.stock}</td>
              <td><input aria-label={`${optionLabel(o)} 재고`} className="field field-sm num" value={edited[o.productOptionId] ?? o.stock}
                onChange={(e) => setEdited({ ...edited, [o.productOptionId]: Number(e.target.value.replace(/\D/g, '')) })} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[12px] text-mute mt-3">재고가 0이면 품절로 보이고, 다시 채우면 판매가 이어져요.</p>
      <div className="flex justify-end gap-2 mt-4">
        <button className="btn btn-line btn-sm" onClick={onClose}>취소</button>
        <button disabled={save.isPending} className="btn btn-ink btn-sm" onClick={submit}>{save.isPending ? '저장 중…' : '저장'}</button>
      </div>
    </div>
  );
}
