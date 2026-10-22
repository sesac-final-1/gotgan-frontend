import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/app/App';
import { bootstrap } from '@/app/bootstrap';
import '@/styles/index.css';

void bootstrap();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
