import { Modal } from '@/shared/components/ui';
import { toast } from '@/shared/stores/toastStore';
import { serviceShortName } from '@/features/admin/constants';
import { useKillServiceMutation } from '@/features/admin/hooks/useSystemQueries';

// 내리기 확인 창 — 담당 박지연. 레플리카 2 이상이면 1개 / 전부를 고른다. 파드는 곧 자동으로 다시 뜬다
export default function SystemKillDialog({ service, onClose }) {
  const kill = useKillServiceMutation();
  const name = serviceShortName(service.name);
  const multi = service.desired > 1;

  const submit = (scope) => kill.mutate({ name: service.name, scope }, {
    onSuccess: ({ deletedPods }) => { toast(`${name} 파드 ${deletedPods.length}개를 내렸어요.`); onClose(); },
    onError: (err) => { toast(err.response?.data?.message ?? '내리지 못했어요. 잠시 후 다시 시도해 주세요.'); onClose(); },
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`${name} 서비스 내리기`}
      footer={(
        <>
          <button type="button" className="btn btn-line" onClick={onClose}>취소</button>
          {multi && <button type="button" className="btn btn-line" disabled={kill.isPending} onClick={() => submit('ONE')}>1개만 내리기</button>}
          <button type="button" className="btn btn-ink" disabled={kill.isPending} onClick={() => submit('ALL')}>{multi ? '전부 내리기' : '내리기'}</button>
        </>
      )}
    >
      <p className="text-sm">파드를 삭제합니다. 새 파드가 자동으로 떠서 잠시 뒤 복구돼요.</p>
      <ul className="mt-2 text-sm text-ink-2 list-disc pl-5">
        {multi && <li>1개만: 남은 파드가 요청을 받아 서비스는 끊기지 않아요.</li>}
        <li>{multi ? '전부' : '내리면'}: 복구될 때까지 이 서비스를 쓰는 기능이 멈춰요.</li>
      </ul>
    </Modal>
  );
}
