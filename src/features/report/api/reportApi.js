// 신고 접수 — 담당 구지훈. 게이트웨이 /api/reports/** → admin-service (구매자 · 판매자)
import { axiosInstance } from '@/shared/api/axiosInstance';

// POST /api/reports {targetType: REVIEW/USER, targetId, reasonCode, detail?} → 201 {reportId, status}
// 중복 409 REPORT_DUPLICATED · 본인 400 REPORT_SELF · 다른 스토어 리뷰 검토 요청 403 REPORT_NOT_OWN_STORE
export const createReport = async (request) => (await axiosInstance.post('/api/reports', request)).data.data;
