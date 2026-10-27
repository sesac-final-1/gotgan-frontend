import { describe, expect, it } from 'vitest';
import { safeHtml, sanitizeHtml } from '@/shared/utils/safeHtml';

describe('sanitizeHtml', () => {
  it('서식 · 문단 · 이미지 · 표는 남긴다', () => {
    const html = '<p>리넨 <b>의류</b><br><img src="https://img.test/a.jpg" alt="셔츠"></p><table><tbody><tr><td>소재</td></tr></tbody></table>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('스크립트 · 이벤트 속성 · javascript: 링크 · style 은 지운다', () => {
    const out = sanitizeHtml('<p onclick="x()" style="color:red">안녕<script>alert(1)</script><img src=x onerror="alert(1)"><a href="javascript:alert(1)">링크</a></p>');
    expect(out).not.toMatch(/script|onclick|onerror|style|javascript:/i);
    expect(out).toContain('안녕');
  });

  it('폼 · iframe 은 통째로 지운다', () => {
    expect(sanitizeHtml('<form action="https://evil.test"><input name="pw"></form><iframe src="https://evil.test"></iframe>끝')).toBe('끝');
  });

  it('링크는 새 탭 + opener 차단', () => {
    expect(sanitizeHtml('<a href="https://gotgan.click">곳간</a>'))
      .toBe('<a href="https://gotgan.click" target="_blank" rel="noopener noreferrer">곳간</a>');
  });

  it('빈 값은 빈 문자열, safeHtml 은 dangerouslySetInnerHTML 모양', () => {
    expect(sanitizeHtml(null)).toBe('');
    expect(safeHtml('<b>굵게</b>')).toEqual({ __html: '<b>굵게</b>' });
  });
});
