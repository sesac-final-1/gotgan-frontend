// product 도메인 API — 담당 박지연. 지금은 목업 데이터, API 준비되면 각 함수 본문만 axiosInstance 호출로 교체 (docs/MOCK-TO-API.md)
import { mockResolve } from '@/mocks/mockApi';
import { categories, products } from '@/mocks/fixtures/catalog';

// TODO(박지연): return (await axiosInstance.get('/api/categories')).data;
export const fetchCategories = () => mockResolve(categories);

// TODO(박지연): 구매자 상품 목록은 서버 페이징 대상(컨벤션 4-7) — GET /api/products?page&size&sort&cat&q
export const fetchProducts = () => mockResolve(products);
