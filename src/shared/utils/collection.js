// 목록 → id 조회용 Map 객체 (화면에서 useMemo 와 함께: const byId = useMemo(() => toMap(list), [list]))
export const toMap = (list = [], key = 'id') => Object.fromEntries(list.map((x) => [x[key], x]));
