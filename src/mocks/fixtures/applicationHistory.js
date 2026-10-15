// 입점 신청 상태 변경 이력 — 관리자 "이력" 탭 · 상세 타임라인 (10/15 추가 요구)
// TODO(박지연 · 구지훈): store-service store_application_history 테이블 + admin-service 조회 API 로 교체
import { applications } from './people';
import { daysAgo } from './_seed';

const ADMIN = '곳간 운영팀 · 정다은';

const extra = {
  'AP-2609-028': [{ at: daysAgo(3, -2), from: '심사대기', to: '보완요청', by: ADMIN, reason: 'KC 전파인증서 사본 미제출' }],
  'AP-2609-025': [
    { at: daysAgo(5), from: '심사대기', to: '보완요청', by: ADMIN, reason: '통신판매업 신고증 해상도 불량 — 재제출 요청' },
    { at: daysAgo(4, 6), from: '보완요청', to: '심사대기', by: '김태식(신청자)', reason: '서류 재제출' },
    { at: daysAgo(4), from: '심사대기', to: '승인', by: ADMIN, reason: '서류 · 카테고리 적합성 확인 완료' },
  ],
  'AP-2609-022': [{ at: daysAgo(8), from: '심사대기', to: '반려', by: ADMIN, reason: '사업자등록번호 조회 불가 · 정품 증빙 불가' }],
};

let seq = 0;
export const applicationHistory = applications
  .flatMap((a) => [
    { at: a.applied, from: null, to: '심사대기', by: `${a.owner}(신청자)`, reason: '입점 신청 접수' },
    ...(extra[a.id] || []),
  ].map((e) => ({ id: `AH-${String(++seq).padStart(4, '0')}`, appId: a.id, storeName: a.storeName, ...e })))
  .sort((x, y) => y.at - x.at);

export const historyOf = (appId) => applicationHistory.filter((h) => h.appId === appId).sort((x, y) => x.at - y.at);
