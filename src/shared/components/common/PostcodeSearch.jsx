// 우편번호 검색창 — 모달 · 폼 안에 펼쳐 넣는다(embed). 팝업 창은 모바일에서 새 창이 떠 쓰지 않음
// onSelect({ zip, addr }) 로 결과를 돌려주고, 닫기는 부르는 쪽이 정한다
import { useEffect, useRef, useState } from 'react';
import { loadPostcode, toPostcodeAddress } from '@/shared/utils/postcode';

export function PostcodeSearch({ onSelect, height = 420 }) {
  const ref = useRef(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadPostcode()
      .then((Postcode) => {
        if (cancelled || !ref.current) return;
        new Postcode({
          oncomplete: (data) => onSelectRef.current(toPostcodeAddress(data)),
          width: '100%',
          height: '100%',
        }).embed(ref.current);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => { cancelled = true; };
  }, []);

  if (failed) return <p role="alert" className="py-6 text-center text-[13px] text-rust">주소 검색을 불러오지 못했어요. 잠시 후 다시 시도해주세요</p>;
  return <div ref={ref} data-testid="postcode-search" className="w-full border border-line-2" style={{ height }} />;
}
