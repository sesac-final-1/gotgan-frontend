import { useRouteError } from 'react-router';

// 화면 오류 — 라우트 코드 분할 뒤 배포가 바뀌면 열려 있던 탭은 옛 화면 파일을 못 받는다 → 새로고침 안내.
// 그 밖의 오류는 홈으로 (화면 하나의 오류가 빈 화면으로 끝나지 않게)
const isChunkError = (e) => /dynamically imported module|Importing a module script failed|error loading dynamically/i.test(e?.message ?? '');

export default function RouteError() {
  const error = useRouteError();
  const chunk = isChunkError(error);
  return (
    <div className="max-w-md mx-auto py-24 px-4 text-center">
      <p className="text-[18px] font-bold">{chunk ? '새 버전이 배포됐어요' : '화면을 표시하지 못했어요'}</p>
      <p className="text-mute text-[13px] mt-2">{chunk ? '새로고침하면 최신 화면으로 열려요.' : '잠시 후 다시 시도해 주세요.'}</p>
      <div className="mt-6 flex justify-center gap-2">
        <button className="btn btn-ink btn-sm" onClick={() => window.location.reload()}>새로고침</button>
        {!chunk && <a href="/" className="btn btn-line btn-sm">홈으로</a>}
      </div>
    </div>
  );
}
