// Vitest 공통 설정 — jest-dom 매처(toBeInTheDocument 등)
import '@testing-library/jest-dom/vitest';

// findBy · waitFor 기다림 한도 1초 → 3초 — 전체 실행 때 테스트 파일이 동시에 돌며 화면이 늦게 그려져 1초를 넘기는 간헐 실패 방지
import { configure } from '@testing-library/react';
configure({ asyncUtilTimeout: 3000 });
