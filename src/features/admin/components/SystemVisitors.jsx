import { useEffect, useState } from 'react';
import LoadTestChart from '@/features/admin/components/LoadTestChart';
import { useVisitorsQuery } from '@/features/admin/hooks/useSystemQueries';
import { visitorBreakdown } from '@/features/admin/monitor';

// 현재 접속자(11/17) — 담당 구지훈. 서버가 최근 60초 안에 신호가 있는 사람을 5초마다 다시 센다(부하테스트 요청 제외).
// 쇼핑몰 탭은 보이는 동안 20초마다 접속 신호, 숨기거나 닫으면 나감 신호를 보낸다(app/usePresence).
// 사람 구분은 브라우저 방문자 ID, 로그인 회원은 대표 역할(관리자 > 판매자 > 구매자) 하나로 나눈다. 비회원 = 총 - 로그인 회원
const KEEP = 120;
const count = (v) => (v == null ? '-' : `${v}명`);

export default function SystemVisitors() {
  const { data } = useVisitorsQuery();
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (data?.visitors == null) return;
    setHistory((h) => [...h, { t: Date.now(), v: data.visitors }].slice(-KEEP));
  }, [data]);

  const items = visitorBreakdown(data);
  return (
    <section aria-label="현재 접속자" className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
      <LoadTestChart label="현재 접속자 (총)" points={history} floor={5} format={(v) => `${v}명`} />
      <ul className="grid grid-cols-5 gap-2" aria-label="접속자 구분">
        {items.map((i) => (
          <li key={i.key} className={`border px-3 py-2 ${i.key === 'total' ? 'border-ink' : 'border-line'} bg-paper`}>
            <span className="text-sm text-mute">{i.label}</span>
            <p className="text-xl font-bold tabular-nums">{count(i.value)}</p>
          </li>
        ))}
      </ul>
      <p className="lg:col-span-2 -mt-1 text-xs text-mute">
        탭을 열면 바로 늘고 닫으면 바로 줄어요(브라우저가 강제 종료되면 최대 1분 뒤). 5초마다 갱신, 부하테스트 가상 사용자는 빼고 셉니다. 역할이 여러 개면 관리자, 판매자, 구매자 순으로 하나만 셉니다.
      </p>
    </section>
  );
}
