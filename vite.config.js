import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// 로컬 개발도 운영(Vercel rewrite)과 같은 "같은 출처 /api" 구조 — 가이드라인 05장
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8080' }, // 로컬 게이트웨이(docker-compose) 또는 kubectl port-forward
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    // 커버리지 = 로직(.js)만 — 화면(.jsx) · 목업은 제외. sonar-project.properties 의 sonar.coverage.exclusions 와 같은 범위
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'], // sonar.javascript.lcov.reportPaths=coverage/lcov.info
      include: ['src/**/*.js'],
      exclude: ['src/mocks/**', 'src/test/**', 'src/**/*.test.js'],
    },
  },
});
