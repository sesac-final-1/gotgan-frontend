import { describe, expect, it } from 'vitest';
import { router } from '@/app/router';

// 라우트 표 — 경로마다 화면 파일이 실제로 있는지 (표의 '폴더/파일명' 오타는 그 화면에 들어가야 드러나므로 여기서 미리)
const lazyRoutes = (routes, parent = '') =>
  routes.flatMap((r) => {
    const path = r.index ? `${parent}(index)` : `${parent}${r.path ?? ''}/`;
    return [...(r.lazy ? [[path, r]] : []), ...lazyRoutes(r.children ?? [], path)];
  });

describe('router', () => {
  const all = lazyRoutes(router.routes);

  it('판매자 · 관리자 · 마이페이지 틀과 화면을 모두 지연 로딩한다', () => {
    expect(all.length).toBeGreaterThanOrEqual(46);
  });

  it.each(all)('%s → 화면 파일이 있다', async (_, route) => {
    const { element } = await route.lazy();
    expect(element).toBeTruthy();
  });
});
