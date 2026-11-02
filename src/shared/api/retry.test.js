import { retryOnce } from '@/shared/api/retry';

const err = (status) => ({ response: { status } });

describe('retryOnce', () => {
  it('한 번만 재시도한다', () => {
    expect(retryOnce(0, err(500))).toBe(true);
    expect(retryOnce(1, err(500))).toBe(false);
    expect(retryOnce(0, new Error('network'))).toBe(true);
  });

  it('요청 제한(429)은 재시도하지 않는다', () => {
    expect(retryOnce(0, err(429))).toBe(false);
  });
});
