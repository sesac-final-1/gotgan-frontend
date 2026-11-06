// 장애 시연 화면 API — 담당 박지연(화면) · 구지훈(API). 설계: 노션 「11/5 장애시연 대시보드 설계초안」 4절
// TODO(박지연): 계약이 나오면 아래 목을 axiosInstance 호출로 바꾸고 systemMock.js 삭제. 응답 모양은 설계 4절 그대로라 화면 · 훅은 그대로
import { mockEvents, mockKill, mockMetrics, mockStatus } from '@/features/admin/api/systemMock';

// GET /api/admin/system/status — 2초 폴링
export const fetchSystemStatus = async () => mockStatus();

// GET /api/admin/system/metrics — 15초 폴링. 값 null = Prometheus 실패
export const fetchSystemMetrics = async () => mockMetrics();

// GET /api/admin/system/events — 타임라인, 최신순 최근 20건
export const fetchSystemEvents = async () => mockEvents();

// POST /api/admin/system/services/{name}/kill — scope: 'ONE' | 'ALL'
export const killService = async ({ name, scope, reason }) => mockKill(name, { scope, reason });
