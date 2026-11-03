// 목록을 아직 못 받았을 때 표시 — 담당 박지연. 받기 전에는 '불러오는 중', 받은 값 없이 실패했으면 다시 시도 안내.
// 화면은 받은 값(data)이 없을 때만 이걸 그리고, 받았으면 목록 · 빈 안내를 그린다(빈 목록과 실패를 구분, 11/3 점검 O-11)
export function ListStatus({ query, failText }) {
  if (query.isError) {
    return (
      <div role="alert" className="py-16 text-center text-sm">
        <p className="text-mute">{failText} 잠시 후 다시 시도해 주세요.</p>
        <button type="button" onClick={() => query.refetch()} className="btn btn-line btn-sm mt-3">다시 시도</button>
      </div>
    );
  }
  return <p className="py-16 text-center text-sm text-mute">불러오는 중…</p>;
}
