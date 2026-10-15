// 상품 상세 · Q&A 영역 — 담당 이경석. 목록은 상품 상세에서 거른 문의(list)를 받는다 (탭 개수와 같은 데이터)
import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Modal, Checkbox, Pill } from '@/shared/components/ui';
import { toast } from '@/shared/stores/toastStore';
import { ymd, maskName } from '@/shared/utils/format';

export default function ShopProductQna({ list }) {
  const [qnaModal, setQnaModal] = useState(false);

  // TODO(이경석): useCreateQnaMutation
  const submit = () => { setQnaModal(false); toast('문의가 등록되었어요. 판매자 답변 시 알림을 드려요.'); };

  return (
    <section id="qna" className="scroll-mt-32 pt-16">
      <div className="flex items-center justify-between border-b border-ink pb-3">
        <h3 className="text-[20px] font-bold">Q&A <span className="num">{list.length}</span></h3>
        <button onClick={() => setQnaModal(true)} className="btn btn-line btn-sm">문의하기</button>
      </div>
      <ul>
        {list.length === 0 && <li className="py-10 text-center text-sm text-mute">등록된 문의가 없습니다.</li>}
        {list.map((q) => (
          <li key={q.id} className="py-4 border-b border-line text-[13.5px]">
            <div className="flex items-center gap-2 text-[12px] text-mute">
              <Pill tone={q.a ? 'mute' : 'line'}>{q.a ? '답변완료' : '답변대기'}</Pill>
              {/* TODO(이경석): 문의 응답에 작성자 이름(author.name) 필요 — 목업 문의엔 userId 만 있어 '구매자' 표시 */}
              {maskName(q.author?.name ?? '구매자')} · {ymd(q.date)}
            </div>
            {q.secret ? (
              <p className="mt-2 flex items-center gap-1.5 text-mute"><Lock size={13} /> 비밀글입니다.</p>
            ) : (
              <>
                <p className="mt-2"><b className="mr-2">Q</b>{q.q}</p>
                {q.a && <p className="mt-2 text-ink-2"><b className="mr-2 text-point">A</b>{q.a}</p>}
              </>
            )}
          </li>
        ))}
      </ul>

      <Modal open={qnaModal} onClose={() => setQnaModal(false)} title="상품 문의하기"
        footer={<><button className="btn btn-line btn-sm" onClick={() => setQnaModal(false)}>취소</button><button className="btn btn-ink btn-sm" onClick={submit}>등록</button></>}>
        <label className="label">문의 유형</label>
        <select className="field mb-4"><option>상품</option><option>배송</option><option>교환/반품</option><option>기타</option></select>
        <label className="label">내용</label>
        <textarea rows={5} className="field" placeholder="상품에 대해 궁금한 점을 남겨주세요. (개인정보 입력 금지)" />
        <Checkbox className="mt-3" checked label="비밀글로 문의하기" />
      </Modal>
    </section>
  );
}
