import { Search } from 'lucide-react';

// 목록 검색창 — 목업 회원 관리 검색창과 같은 모양. 받아온 목록 안에서 검색(서버 요청 없음, 컨벤션 4-7)
export function SearchInput({ value, onChange, placeholder = '검색', className = '' }) {
  return (
    <div className={`flex items-center border border-line-2 h-9 px-2.5 w-full sm:w-64 bg-white ${className}`}>
      <Search size={15} className="text-mute" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="flex-1 px-2 text-[13px] outline-none bg-transparent" />
    </div>
  );
}
