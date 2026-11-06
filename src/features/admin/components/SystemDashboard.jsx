// 장애 시연 화면 /admin/system — 담당 박지연. 서비스를 내리고 그 기능만 멈췄다 살아나는 것을 한 화면에서 보여 준다(F-1)
import { PageHead } from '@/shared/components/ui';
import SystemTimeline from '@/features/admin/components/SystemTimeline';
import { ListStatus } from '@/features/product/components/ListStatus';
import SystemFeaturePanel from '@/features/admin/components/SystemFeaturePanel';
import SystemLinks from '@/features/admin/components/SystemLinks';
import SystemServicePanel from '@/features/admin/components/SystemServicePanel';
import { useSystemMetricsQuery, useSystemStatusQuery } from '@/features/admin/hooks/useSystemQueries';

export default function SystemDashboard() {
  const statusQuery = useSystemStatusQuery();
  const { data: metrics } = useSystemMetricsQuery(); // 실패해도 상태는 보여 준다 — 오류율만 '-'
  const status = statusQuery.data;

  return (
    <div>
      <PageHead title="시스템 상태" desc="서비스를 내리면 어떤 기능이 멈추고 얼마 만에 복구되는지 보여 줍니다." right={<SystemLinks />} />
      {statusQuery.isError && status && (
        <p role="alert" className="mb-3 px-4 py-3 bg-rust-soft text-lg font-bold text-rust">연결 끊김 — 마지막으로 받은 상태를 보여 주고 있어요.</p>
      )}
      {status ? (
        <div className="grid xl:grid-cols-[3fr_2fr] gap-4 items-start">
          <SystemServicePanel services={status.services} metrics={metrics} chaosEnabled={status.chaosEnabled} />
          <div className="grid gap-4">
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
