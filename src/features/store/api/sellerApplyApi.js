// 입점 신청 API — 담당 박지연. 계약: backend docs/api/store.md 2절(신청) · 2-1절(서류 업로드 주소) · 2-2절(내 신청 상태) · 2-3절(보완 재제출)
// 새 화면이라 목업 이름이 없어 필드는 API 이름 그대로, 시각만 Date 로 바꾼다
import { axiosInstance } from '@/shared/api/axiosInstance';

const date = (s) => (s ? new Date(s) : null);

// GET /api/seller/apply/me — 가장 최근 신청 1건, 신청한 적 없으면 data: null (200)
export const toMyApplication = (r) => r && ({
  ...r,
  statusReason: r.statusReason ?? '',
  requestedDocs: r.requestedDocs ?? [], // SUPPLEMENT 일 때만, 10/29 전 보완요청은 null
  submittedAt: date(r.submittedAt),
  statusChangedAt: date(r.statusChangedAt),
  supplementDueAt: date(r.supplementDueAt),
  reapplyAvailableAt: date(r.reapplyAvailableAt),
  history: (r.history ?? []).map((h) => ({ ...h, reason: h.reason ?? '', changedAt: date(h.changedAt) })),
  submitted: r.submitted ? { ...r.submitted, documents: (r.submitted.documents ?? []).map((d) => ({ ...d, uploadedAt: date(d.uploadedAt) })) } : null, // 제출한 내용 — 재제출 폼의 처음 값
});

export const fetchMyApplication = async () => toMyApplication((await axiosInstance.get('/api/seller/apply/me')).data.data);

// POST /api/seller/apply/documents/presign — [{ docType, file }] 1~13개 → [{ key, uploadUrl, expiresAt }] (같은 순서)
export const presignApplyDocuments = async (docs) =>
  (await axiosInstance.post('/api/seller/apply/documents/presign', {
    files: docs.map(({ docType, file }) => ({ docType, contentType: file.type, size: file.size })),
  })).data.data;

// 서류를 S3 에 올리고 신청 본문의 documents[] 를 돌려준다 — presigned PUT 은 우리 API 가 아니라 axiosInstance(토큰 헤더) 대신 fetch.
// Content-Type 이 서명에 들어가 있어 발급 때와 같아야 한다 (다르면 S3 403). 리뷰 사진 업로드와 같은 방식
export async function uploadApplyDocuments(docs) {
  if (docs.length === 0) return [];
  const issued = await presignApplyDocuments(docs);
  await Promise.all(issued.map(async ({ uploadUrl }, i) => {
    const res = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': docs[i].file.type }, body: docs[i].file });
    if (!res.ok) throw new Error('서류를 올리지 못했어요. 다시 시도해 주세요.');
  }));
  return issued.map(({ key }, i) => ({ docType: docs[i].docType, key, originalName: docs[i].file.name }));
}

// POST /api/seller/apply — 서류 먼저 올린 뒤 키로 제출 → 201 { applicationId, applicationNo, status, submittedAt }
// 409: APPLY_STORE_ALREADY_EXISTS(1인 1스토어) · APPLY_IN_PROGRESS · APPLY_REAPPLY_RESTRICTED · APPLY_SLUG_DUPLICATED · APPLY_STORE_NAME_DUPLICATED
export const applySeller = async ({ docs, ...request }) => {
  const documents = await uploadApplyDocuments(docs);
  return (await axiosInstance.post('/api/seller/apply', { ...request, documents })).data.data;
};

// PATCH /api/seller/apply/{applicationId}/resubmit (2-3절) — 바뀐 항목만 보내고, 다시 낸 서류가 있을 때만 documents 를 붙인다(내용 보완은 서류 없이)
// → 200 { applicationId, status: PENDING, resubmittedAt }. 409 APPLY_INVALID_STATUS(기한 지남 · 이미 처리됨) · 주소 · 스토어명 중복, 400 APPLY_DOCUMENT_INVALID
export const resubmitApplication = async ({ applicationId, docs, request }) => {
  const documents = await uploadApplyDocuments(docs);
  const body = documents.length ? { ...request, documents } : request;
  return (await axiosInstance.patch(`/api/seller/apply/${applicationId}/resubmit`, body)).data.data;
};
