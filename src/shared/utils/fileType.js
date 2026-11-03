// 업로드 파일의 실제 형식 — 브라우저 file.type 은 확장자만 본다(이름이 .jpg 인 PNG → image/jpeg).
// presign 은 Content-Type 으로 키 확장자를 정하고, S3 업로드 검사(upload-guard)는 앞 바이트로 형식을 확인해
// 둘이 다르면 지운다 → 화면에는 깨진 이미지. 그래서 올리기 전에 앞 바이트로 형식을 정해 다시 담는다
const SIGNATURES = [
  ['image/jpeg', (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ['image/png', (b) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)],
  ['image/webp', (b) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP'],
  ['application/pdf', (b) => ascii(b, 0, 5) === '%PDF-'],
];
const ascii = (b, from, to) => String.fromCharCode(...b.slice(from, to));

/** 앞 12바이트로 본 형식 — 위 4종이 아니면 null */
export async function sniffType(file) {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  return SIGNATURES.find(([, test]) => test(head))?.[0] ?? null;
}

/** 실제 형식으로 type 을 바꾼 File (같으면 그대로). 4종이 아니면 올리기 전에 막는다 */
export async function withRealType(file) {
  const type = await sniffType(file);
  if (!type) throw new Error(`${file.name} — JPG · PNG · WEBP · PDF 파일만 올릴 수 있어요`);
  return type === file.type ? file : new File([file], file.name, { type });
}
