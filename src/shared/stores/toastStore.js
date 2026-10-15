import { create } from 'zustand';

// 화면 하단 토스트 — 어디서든 toast('메시지') 로 띄운다 (목업 AppProvider.toast 대체)
export const useToastStore = create((set, get) => ({
  current: null, // { msg, id }
  show: (msg) => {
    const id = Date.now();
    set({ current: { msg, id } });
    setTimeout(() => {
      if (get().current?.id === id) set({ current: null });
    }, 2300);
  },
}));

export const toast = (msg) => useToastStore.getState().show(msg);
