import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fallbackSrc, installImageFallback } from './imageFallback';

const fail = (el) => el.dispatchEvent(new Event('error'));

describe('이미지 대체', () => {
  let uninstall;
  beforeEach(() => { uninstall = installImageFallback(); });
  afterEach(() => { uninstall(); document.body.innerHTML = ''; });

  const img = (attrs = {}) => {
    const el = document.createElement('img');
    el.setAttribute('src', 'https://s3.example/a.jpg');
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    document.body.append(el);
    return el;
  };

  it.each([[1, 'food'], [2, 'living'], [3, 'fashion'], [4, 'shoes'], [5, 'beauty'], [6, 'digital']])(
    '상위 카테고리 %i → %s', (cat, file) => {
      expect(fallbackSrc({ cat: String(cat) })).toBe(`/images/fallback/${file}.svg`);
    },
  );

  it('모르는 카테고리 · 속성 없음 → 기본 이미지', () => {
    expect(fallbackSrc({ cat: '99' })).toBe('/images/fallback/default.svg');
    expect(fallbackSrc()).toBe('/images/fallback/default.svg');
  });

  it('로드 실패한 상품 이미지를 카테고리 이미지로 바꾼다 — srcset 도 지운다', () => {
    const el = img({ 'data-cat': '1', srcset: 'https://s3.example/a.jpg 1x' });
    fail(el);
    expect(el.getAttribute('src')).toBe('/images/fallback/food.svg');
    expect(el.hasAttribute('srcset')).toBe(false);
  });

  it('스토어 · 프로필은 종류 속성으로 고른다', () => {
    const store = img({ 'data-fallback': 'store' });
    const avatar = img({ 'data-fallback': 'avatar' });
    fail(store);
    fail(avatar);
    expect(store.getAttribute('src')).toBe('/images/fallback/store.svg');
    expect(avatar.getAttribute('src')).toBe('/images/fallback/avatar.svg');
  });

  it('대체 이미지까지 실패하면 다시 바꾸지 않는다 — 무한 반복 방지', () => {
    const el = img();
    fail(el);
    el.setAttribute('src', '/images/fallback/food.svg');
    fail(el);
    expect(el.getAttribute('src')).toBe('/images/fallback/food.svg');
  });

  it('화면이 사진을 바꾼 뒤 실패해도 다시 대체한다 (상품 상세 갤러리)', () => {
    const el = img({ 'data-cat': '5' });
    fail(el);
    el.setAttribute('src', 'https://s3.example/b.jpg');
    fail(el);
    expect(el.getAttribute('src')).toBe('/images/fallback/beauty.svg');
  });

  it('이미지가 아닌 요소의 오류는 무시한다', () => {
    const script = document.createElement('script');
    script.setAttribute('src', 'https://s3.example/a.js');
    document.body.append(script);
    fail(script);
    expect(script.getAttribute('src')).toBe('https://s3.example/a.js');
  });

  it('해제하면 더 바꾸지 않는다', () => {
    uninstall();
    const el = img({ 'data-cat': '1' });
    fail(el);
    expect(el.getAttribute('src')).toBe('https://s3.example/a.jpg');
    uninstall = installImageFallback();
  });
});
