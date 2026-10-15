// user 도메인 API — 담당 이경석
import { mockResolve } from '@/mocks/mockApi';
import { ME, myAddresses } from '@/mocks/fixtures/people';
import { myPointHistory, myPointBalance } from '@/mocks/fixtures/points';

// TODO(이경석): GET /api/users/me
export const fetchMe = () => mockResolve(ME);

// TODO(이경석): GET /api/users/me/addresses
export const fetchMyAddresses = () => mockResolve(myAddresses);

// TODO(이경석): GET /api/users/me/points — { balance, history[] }
export const fetchMyPoints = () => mockResolve({ balance: myPointBalance, history: myPointHistory });
