// 정산 상세 본문 — 담당 구지훈. 판매자 정산 내역 · 관리자 정산 관리 상세 모달이 같이 쓴다 (응답 모양이 같음)
import { KV, StatusPill } from '@/shared/components/ui';
import { won, comma, ymd, ymdhm, pct } from '@/shared/utils/format';

const ACTOR = { SYSTEM: '자동', ADMIN: '곳간 운영팀' };

export default function SettlementDetailBody({ d }) {
  return (
    <div className="text-[14px]">
      <div className="text-[13px] text-mute mb-3">대상기간 {ymd(d.start)} ~ {ymd(d.end)} · {d.status === '지급완료' ? '지급일' : '지급 예정일'} {ymd(d.pay)}</div>
      <div className="border-t border-ink num">
        {[['구매확정 매출', d.gross], ['판매수수료 (카테고리별)', -d.commission], ['결제수수료 (2.2%)', -d.pgFee]].map(([k, v]) => (
          <div key={k} className="flex justify-between py-2.5 border-b border-line"><span className="font-sans text-ink-2">{k}</span><span>{v < 0 ? '−' : ''}{won(Math.abs(v))}</span></div>
        ))}
        <div className="flex justify-between py-3 text-[17px] font-bold"><span className="font-sans">정산금액</span><span>{won(d.payout)}</span></div>
      </div>
      <div className="mt-2 max-h-56 overflow-y-auto border-t border-line">
        <table className="tbl text-[12.5px]">
          <thead><tr><th>상품주문</th><th>구매확정</th><th className="text-right">금액</th><th className="text-right">수수료율</th><th className="text-right">정산</th></tr></thead>
          <tbody>
            {d.items.map((i) => (
              <tr key={i.orderItemId}>
                <td><div className="font-medium">{i.productName}</div><div className="text-[11px] text-mute num">{i.orderNo}{i.carriedOver && ' · 이월'}</div></td>
                <td className="num text-ink-2 whitespace-nowrap">{ymd(i.confirmedAt)}</td>
                <td className="text-right num">{comma(i.amount)}</td>
                <td className="text-right num">{pct(i.rate, 1)}</td>
                <td className="text-right num font-semibold">{comma(i.payout)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3"><KV rows={[['지급 계좌', d.bank], ...(d.holdReason ? [['보류 사유', d.holdReason]] : [])]} /></div>
      {d.history.length > 0 && (
        <ol className="mt-3 space-y-1.5 text-[12.5px]">
          {d.history.map((h, idx) => (
            <li key={`${h.at?.getTime()}-${idx}`} className="flex items-center gap-1.5 flex-wrap">
              <span className="num text-mute">{h.at ? ymdhm(h.at) : ''}</span>
              {h.from && <><StatusPill s={h.from} /><span className="text-mute">→</span></>}<StatusPill s={h.to} />
              <span className="text-ink-2">{ACTOR[h.actor] ?? h.actor}{h.reason && ` · ${h.reason}`}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
