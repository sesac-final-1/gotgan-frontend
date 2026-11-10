import { useState } from 'react';
import { Modal } from '@/shared/components/ui';
import { toast } from '@/shared/stores/toastStore';
import { serviceShortName } from '@/features/admin/constants';
import { useKillOneEachMutation } from '@/features/admin/hooks/useSystemQueries';

// 시나리오 — 담당 박지연. 레플리카 2 서비스를 전부 1개씩 내려도 쇼핑몰이 그대로 도는지 보여 준다(admin.md 7-2-1, 노션 11/10 요청)
// 대상은 서버와 같은 기준(내릴 수 있고 레플리카 2 이상)으로 상태 응답에서 계산한다
const NOT_READY_MESSAGE = '모든 대상 서비스가 정상일 때만 실행할 수 있어요.';

/** 버튼을 막는 이유 — 없으면 null */
function blockedReason({ chaosEnabled, targets }) {
  if (!chaosEnabled) return '내리기 기능이 꺼져 있어요.';
  if (targets.length === 0) return '대상 서비스가 없어요.';
  if (targets.some((s) => s.state !== 'UP')) return NOT_READY_MESSAGE;
  return null;
}

export default function SystemScenarioPanel({ services, chaosEnabled }) {
  const [confirming, setConfirming] = useState(false);
  const kill = useKillOneEachMutation();
  const targets = services.filter((s) => s.killable && s.desired >= 2);
  const names = targets.map((s) => serviceShortName(s.name)).join(' · ');
  const blocked = blockedReason({ chaosEnabled, targets });

  const submit = () => kill.mutate(undefined, {
    onSuccess: ({ services: done }) => { toast(`${done.length}개 서비스 파드를 1개씩 내렸어요.`); setConfirming(false); },
    onError: (err) => {
      const { code, message } = err.response?.data ?? {};
      toast(code === 'SYSTEM_SCENARIO_NOT_READY' ? NOT_READY_MESSAGE : message ?? '내리지 못했어요. 잠시 후 다시 시도해 주세요.');
      setConfirming(false);
    },
  });

  return (
    <section aria-label="시나리오" className="border border-line bg-paper px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      <h2 className="text-lg font-bold">시나리오</h2>
      <button type="button" className="btn btn-ink" disabled={!!blocked || kill.isPending} onClick={() => setConfirming(true)}>
        레플리카 2 서비스 1개씩 내리기
      </button>
      <div className="text-base">
        <span className="text-mute">대상</span> <b>{names || '-'}</b>
        <span className="ml-3 text-sm text-mute">{blocked ?? '각 서비스에 파드 1개가 남아 쇼핑몰은 계속 동작해요.'}</span>
      </div>
      {confirming && (
        <Modal
          open
          onClose={() => setConfirming(false)}
          title="레플리카 2 서비스 1개씩 내리기"
          footer={(
            <>
              <button type="button" className="btn btn-line" onClick={() => setConfirming(false)}>취소</button>
              <button type="button" className="btn btn-ink" disabled={kill.isPending} onClick={submit}>1개씩 내리기</button>
            </>
          )}
        >
          <p className="text-sm">{names} 파드를 1개씩 지웁니다. 각 서비스에 1개가 남아 있어 쇼핑몰은 계속 동작해요.</p>
          <p className="mt-2 text-sm text-ink-2">하나라도 정상이 아니면 아무것도 지우지 않아요. 내린 뒤 1분 동안은 같은 서비스를 다시 내릴 수 없어요.</p>
        </Modal>
      )}
    </section>
  );
}
