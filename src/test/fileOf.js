// 테스트용 업로드 파일 — 내용 앞에 type 에 맞는 시그니처를 붙인다(업로드 전 앞 바이트로 형식을 확인하므로 — shared/utils/fileType)
const HEAD = {
  'image/jpeg': [0xff, 0xd8, 0xff, 0xe0],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'image/webp': [...'RIFF\0\0\0\0WEBP'].map((c) => c.charCodeAt(0)),
  'application/pdf': [...'%PDF-'].map((c) => c.charCodeAt(0)),
};

/** size 바이트짜리 파일(시그니처보다 작으면 시그니처 길이) — 지원하지 않는 type 은 시그니처 없이 */
export function fileOf(name, type, size = 16) {
  const head = HEAD[type] ?? [];
  const bytes = new Uint8Array(Math.max(size, head.length));
  bytes.set(head);
  return new File([bytes], name, { type });
}
