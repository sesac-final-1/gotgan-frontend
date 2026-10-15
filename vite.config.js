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
    coverage: { reporter: ['text', 'lcov'] }, // sonar.javascript.lcov.reportPaths=coverage/lcov.info
  },
});
