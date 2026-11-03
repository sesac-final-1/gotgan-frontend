import { describe, expect, it } from 'vitest';
import { sniffType, withRealType } from '@/shared/utils/fileType';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d];
const JPG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10];
const WEBP = [...'RIFF'].map((c) => c.charCodeAt(0)).concat([0, 0, 0, 0], [...'WEBP'].map((c) => c.charCodeAt(0)));
const file = (bytes, name, type) => new File([new Uint8Array(bytes)], name, { type });

describe('sniffType', () => {
  it('앞 바이트로 jpeg · png · webp · pdf 를 알아본다', async () => {
    expect(await sniffType(file(JPG, 'a.jpg', 'image/jpeg'))).toBe('image/jpeg');
    expect(await sniffType(file(PNG, 'a.png', 'image/png'))).toBe('image/png');
    expect(await sniffType(file(WEBP, 'a.webp', 'image/webp'))).toBe('image/webp');
    expect(await sniffType(file([...'%PDF-1.7'].map((c) => c.charCodeAt(0)), 'a.pdf', 'application/pdf'))).toBe('application/pdf');
  });

  it('4종이 아니면 null', async () => {
    expect(await sniffType(file([...'hello'].map((c) => c.charCodeAt(0)), 'a.jpg', 'image/jpeg'))).toBeNull();
  });
});

describe('withRealType', () => {
  it('이름이 .jpg 인 PNG — type 을 image/png 로 바꾼다 (QA Q-구-14)', async () => {
    const f = await withRealType(file(PNG, 'KakaoTalk.jpg', 'image/jpeg'));
    expect(f.type).toBe('image/png');
    expect(f.name).toBe('KakaoTalk.jpg');
  });

  it('형식이 맞으면 같은 파일 그대로', async () => {
    const original = file(JPG, 'a.jpg', 'image/jpeg');
    expect(await withRealType(original)).toBe(original);
  });

  it('4종이 아니면 올리기 전에 막는다', async () => {
    await expect(withRealType(file([1, 2, 3], 'evil.jpg', 'image/jpeg'))).rejects.toThrow('evil.jpg');
  });
});
