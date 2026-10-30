// 입점 신청 · 보완 재제출 화면 공용 부품 — 담당 박지연
import { useRef } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { PRODUCT_PHOTO_MAX } from '@/features/store/constants';
import { cx } from '@/shared/utils/format';

export function Field({ label, req, children, hint }) {
  return (
    <div>
      <label className="label">{label}{req && <span className="text-point ml-0.5">*</span>}</label>
      {children}
      {hint && <p className="text-[12px] text-mute mt-1.5">{hint}</p>}
    </div>
  );
}

/** 서류 한 칸 — 단건은 File 1개, 상품 사진은 File 배열. 파일 선택은 숨긴 input 으로. current = 지금 낸 파일 이름(재제출 화면) */
export function Doc({ type, files, onPick, onClear, current }) {
  const input = useRef(null);
  const list = type.multiple ? files : files ? [files] : [];
  const done = list.length > 0;
  const idle = current ? `지금 낸 파일: ${current}` : type.desc;
  return (
    <div className={cx('border p-4 flex items-center gap-4', done ? 'border-ink' : 'border-dashed border-line-2')}>
      <div className={cx('w-10 h-10 flex items-center justify-center shrink-0', done ? 'bg-ink text-white' : 'bg-cream text-mute')}>{done ? <FileText size={18} /> : <Upload size={18} />}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold">{type.label} <span className="text-point">*</span></div>
        <div className="text-[12px] text-mute truncate">{done ? list.map((f) => f.name).join(', ') + (type.multiple ? ` · ${list.length}장` : '') : idle}</div>
      </div>
      <input ref={input} type="file" accept={type.accept} multiple={type.multiple} className="hidden" aria-label={type.label}
        onChange={(e) => { onPick(type.multiple ? [...e.target.files] : e.target.files[0] ?? null); e.target.value = ''; }} />
      {done && type.multiple && list.length < PRODUCT_PHOTO_MAX && <button type="button" onClick={() => input.current.click()} className="btn btn-sm btn-line">추가</button>}
      {done
        ? <button type="button" onClick={onClear} className="btn btn-sm btn-ghost" aria-label={`${type.label} 지우기`}><X size={14} /></button>
        : <button type="button" onClick={() => input.current.click()} className="btn btn-sm btn-line">파일 선택</button>}
    </div>
  );
}
