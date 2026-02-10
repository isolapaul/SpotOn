import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

interface ToastData {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastStore {
  toasts: ToastData[];
  showToast: (message: string, type: ToastType) => void;
  removeToast: (id: number) => void;
}

let toastId = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  
  showToast: (message, type) => {
    const id = ++toastId;
    // Only keep one toast at a time - replace existing
    set({ toasts: [{ id, message, type }] });
  },
  
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },
}));
