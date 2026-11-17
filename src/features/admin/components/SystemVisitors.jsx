import { useEffect, useState } from 'react';
import LoadTestChart from '@/features/admin/components/LoadTestChart';
import { useVisitorsQuery } from '@/features/admin/hooks/useSystemQueries';

// 현재 접속자(11/17) — 담당 구지훈. 서버가 최근 120초 안에 요청한 사람을 5초마다 다시 센다(부하테스트 요청 제외).
// 화면을 보는 동안 받은 값으로 추이를 그린다(최근 10분, 새로 열면 다시 쌓임)
const KEEP = 120;

export default function SystemVisitors() {
  const { data } = useVisitorsQuery();
  const [history, setHistory] = useState({ visitors: [], members: [] });

  useEffect(() => {
    if (data?.visitors == null) return;
    const t = Date.now();
    setHistory((h) => ({
      visitors: [...h.visitors, { t, v: data.visitors }].slice(-KEEP),
      members: [...h.members, { t, v: data.members ?? 0 }].slice(-KEEP),
    }));
  }, [data]);

  return (
    <section aria-label="현재 접속자" className="grid sm:grid-cols-2 gap-3">
      <LoadTestChart label="현재 접속자 (회원 + 비회원)" points={history.visitors} floor={5} format={(v) => `${v}명`} />
      <LoadTestChart label="로그인 회원" points={history.members} floor={5} format={(v) => `${v}명`} />
      <p className="sm:col-span-2 -mt-1 text-xs text-mute">최근 2분 안에 요청한 사람 기준, 5초마다 갱신. 부하테스트 가상 사용자는 빼고 셉니다.</p>
    </section>
  );
}
