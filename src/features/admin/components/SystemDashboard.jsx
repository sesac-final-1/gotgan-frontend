// 장애 시연 화면 /admin/system — 담당 박지연. 서비스를 내리고 그 기능만 멈췄다 살아나는 것을 한 화면에서 보여 준다(F-1)
import { useState } from 'react';
import { PageHead } from '@/shared/components/ui';
import SystemTimeline from '@/features/admin/components/SystemTimeline';
import { ListStatus } from '@/features/product/components/ListStatus';
import SystemFeaturePanel from '@/features/admin/components/SystemFeaturePanel';
import SystemLinks from '@/features/admin/components/SystemLinks';
import SystemLoadTestPanel from '@/features/admin/components/SystemLoadTestPanel';
import SystemScenarioPanel from '@/features/admin/components/SystemScenarioPanel';
import SystemServicePanel from '@/features/admin/components/SystemServicePanel';
import SystemMonitorPanel from '@/features/admin/components/SystemMonitorPanel';
import SystemVisitors from '@/features/admin/components/SystemVisitors';
import { SCENARIO_LABEL } from '@/features/admin/loadTest';
import { useLoadTestQuery, useSystemMetricsQuery, useSystemStatusQuery } from '@/features/admin/hooks/useSystemQueries';
import { SCENARIO_SERVICES } from '@/features/admin/monitor';

export default function SystemDashboard() {
  const [scenario, setScenario] = useState('BROWSE');
  const { data: loadTest } = useLoadTestQuery();
  const running = loadTest?.load?.state === 'RUNNING';
  const highlighted = SCENARIO_SERVICES[running ? loadTest.load.scenario : scenario] ?? [];
  const statusQuery = useSystemStatusQuery();
  const { data: metrics } = useSystemMetricsQuery(); // 실패해도 상태는 보여 준다 — 오류율만 '-'
  const status = statusQuery.data;

  return (
    <div>
      <PageHead title="시스템 상태" desc="장애 발생 시 기능별 영향 범위와 복구 소요 시간을 확인합니다." right={<SystemLinks />} />
      {running && (
        <a href="#loadtest" role="status" className="sticky top-0 z-10 mb-3 flex items-center gap-2 px-4 py-2 bg-rust text-paper font-bold">
          <span className="inline-block w-2 h-2 rounded-full bg-paper animate-pulse" aria-hidden="true" />
          부하테스트 진행 중: {SCENARIO_LABEL[loadTest.load.scenario] ?? loadTest.load.scenario}. 그래프와 숫자에 가상 사용자 요청이 섞여 있어요.
        </a>
      )}
      {statusQuery.isError && status && (
        <p role="alert" className="mb-3 px-4 py-3 bg-rust-soft text-lg font-bold text-rust">연결 끊김 — 마지막으로 받은 상태를 보여 주고 있어요.</p>
      )}
      {status ? (
        <div className="grid gap-4">
          <SystemVisitors />
          <div id="loadtest"><SystemLoadTestPanel scenario={scenario} onScenarioChange={setScenario} /></div>
          <SystemMonitorPanel />
          <SystemScenarioPanel services={status.services} chaosEnabled={status.chaosEnabled} />
          <SystemServicePanel services={status.services} metrics={metrics} chaosEnabled={status.chaosEnabled} highlighted={highlighted} />
          <div className="grid xl:grid-cols-2 gap-4 items-start">
            <SystemFeaturePanel features={status.features} />
            <SystemTimeline />
          </div>
        </div>
      ) : (
        <ListStatus query={statusQuery} failText="시스템 상태를 불러오지 못했어요." />
      )}
    </div>
  );
}
