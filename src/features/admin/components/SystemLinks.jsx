import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Modal } from '@/shared/components/ui';

// 시연용 바로가기 — 담당 박지연. 쇼핑몰은 X-Frame-Options 때문에 화면 안에 넣지 않고 새 창으로 연다(설계 3절).
// Grafana 는 인터넷에 열지 않아서 port-forward 로만 접속한다
const GRAFANA_COMMAND = 'kubectl -n monitoring port-forward svc/grafana 3000';

export default function SystemLinks() {
  const [guideOpen, setGuideOpen] = useState(false);
  return (
    <div className="flex gap-2">
      <a href="/" target="_blank" rel="noopener noreferrer" className="btn btn-line btn-sm inline-flex items-center gap-1">
        쇼핑몰 새 창으로 열기 <ExternalLink size={14} aria-hidden="true" />
      </a>
      <button type="button" className="btn btn-line btn-sm" onClick={() => setGuideOpen(true)}>Grafana 안내</button>
      <Modal open={guideOpen} onClose={() => setGuideOpen(false)} title="Grafana 접속 방법">
        <p className="text-sm">자세한 그래프 · 로그 · 트레이스는 Grafana 에서 봅니다. 외부에 열려 있지 않아 터미널에서 먼저 연결해야 해요.</p>
        <pre className="mt-3 p-3 bg-cream text-[13px] overflow-x-auto"><code>{GRAFANA_COMMAND}</code></pre>
        <p className="mt-3 text-sm">연결한 뒤 <a href="http://localhost:3000" target="_blank" rel="noopener noreferrer" className="underline">http://localhost:3000</a> 을 여세요.</p>
      </Modal>
    </div>
  );
}
