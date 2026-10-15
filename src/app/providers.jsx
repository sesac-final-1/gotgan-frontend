import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// 서버 상태 기본값 (컨벤션 4-6) — 목록은 한 번 받아 캐시하고 화면에서 검색 · 정렬 (4-7)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 1분 안에는 같은 목록을 다시 요청하지 않음
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
