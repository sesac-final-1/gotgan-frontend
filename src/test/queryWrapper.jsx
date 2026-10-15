import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// 훅 테스트용 — 테스트마다 새 QueryClient (캐시 공유 없음, 재시도 없음)
export function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, Wrapper };
}
