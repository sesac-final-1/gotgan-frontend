// 마이페이지 상품 문의 — 담당 이경석. 목업은 빈 상태 화면만 있다
import { Link } from 'react-router';
import { Empty } from '@/shared/components/ui';
import { MyPageHead } from '@/shared/layouts/MyPageLayout';

export default function MyQna() {
  return (
    <div>
      <MyPageHead>상품 문의</MyPageHead>
      <Empty title="작성한 문의가 없어요" desc="상품 상세 페이지의 Q&A 탭에서 문의할 수 있어요." action={<Link to="/help" className="btn btn-line btn-sm">고객센터 FAQ 보기</Link>} />
    </div>
  );
}
