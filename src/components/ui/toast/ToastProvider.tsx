'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

type ToastKind = 'success' | 'error';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/**
 * B.1 Polish (mục 6.6, 09/2026) — port `showToast()` (public/app.js,
 * Flask gốc — repo mindx-jobs) sang React. Flask gốc: 1 hàm global gắn
 * lên `window`, tạo trực tiếp DOM node, tự xoá sau timeout. Ở đây thay
 * bằng Context + state — 1 component cha (đặt ở layout.tsx, bọc quanh
 * `.shell`, ĐÚNG chỗ `QueryProvider` cũ từng đứng trước khi bị gỡ) quản
 * lý danh sách toast đang hiện, các component con chỉ gọi
 * `useToast().success(...)`/`.error(...)`.
 *
 * Thời gian tự ẩn (3200ms) và class CSS (`.toast-stack`, `.toast`,
 * `.toast-success`/`.toast-error`) LẤY ĐÚNG từ `showToast()` gốc — xem
 * `mindx-jobs/public/app.js` dòng ~99-107 — không tự bịa số mới, tái
 * dùng nguyên bộ CSS đã có sẵn ở `09-misc-toasts.css` (chỉ thiếu đúng
 * phần component React bắn ra class đó, xem comment trong file CSS).
 *
 * Không dùng animation "exit" (fade-out trước khi remove) — bản gốc
 * cũng không có, chỉ có `toast-in` lúc xuất hiện; giữ đúng hành vi cũ
 * thay vì thêm tính năng ngoài phạm vi port lại.
 */

const AUTO_DISMISS_MS = 3200;
let nextToastId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  // Lưu timer theo id để clear đúng lúc unmount sớm (component cha bị
  // gỡ trước khi timeout chạy hết, vd chuyển trang) — tránh setState
  // sau khi unmount.
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++nextToastId;
      setToasts((prev) => [...prev, { id, kind, message }]);
      const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message: string) => push('success', message),
      error: (message: string) => push('error', message),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" id="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`} role="status">
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Ném lỗi rõ ràng nếu gọi ngoài `ToastProvider` thay vì trả về
 * no-op im lặng — sai sót thiếu Provider nên fail nhanh lúc dev, không
 * để lỗi "gọi toast mà chẳng thấy gì" khó dò khi lên production.
 */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast() phải được gọi bên trong <ToastProvider>.');
  }
  return ctx;
}
