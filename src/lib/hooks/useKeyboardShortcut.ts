'use client';

import { useEffect } from 'react';

/**
 * B.4 Polish (mục 6.6, 09/2026) — hook `addEventListener('keydown', ...)`
 * DÙNG CHUNG duy nhất cho toàn app, thay vì mỗi component tự gắn/gỡ
 * listener riêng (rải rác, dễ quên cleanup gây leak). Nơi cần phím tắt
 * chỉ gọi `useKeyboardShortcut('/', callback)` — logic add/remove listener
 * + cleanup chỉ viết đúng 1 lần ở đây.
 *
 * `ignoreWhenTyping` (mặc định true): bỏ qua khi đang gõ trong
 * input/textarea/select/contentEditable — để phím tắt như `/` không vô
 * tình chen ngang lúc người dùng đang gõ chữ "/" thật trong 1 ô nhập nào
 * đó (VD ô ghi chú). Ngoại lệ: `Escape` LUÔN chạy kể cả đang gõ, vì tác
 * dụng thường thấy nhất của nó chính là thoát khỏi ô đang gõ/đóng form —
 * chặn nó lại khi đang gõ sẽ vô hiệu hoá đúng lúc cần nhất.
 */
interface UseKeyboardShortcutOptions {
  enabled?: boolean;
  ignoreWhenTyping?: boolean;
}

// LƯU Ý cho nơi gọi: `callback` CỐ Ý không nằm trong dependency array của
// effect bên dưới (tránh gỡ/gắn lại listener mỗi lần component re-render
// vì truyền callback dạng arrow function inline). Hệ quả: listener chỉ
// "chụp" đúng closure mới nhất khi effect chạy LẠI — tức khi `key` hoặc
// `enabled` đổi giá trị. Nếu callback cần đọc state thay đổi theo thời
// gian (VD đóng 1 card xác nhận chỉ khi đang mở), đổi `enabled` theo
// đúng state đó (`enabled: showConfirm`) thay vì tự kiểm tra state ở
// TRONG callback — xem ConfirmActionButton.tsx để có ví dụ thật.

export function useKeyboardShortcut(
  key: string,
  callback: (event: KeyboardEvent) => void,
  { enabled = true, ignoreWhenTyping = true }: UseKeyboardShortcutOptions = {}
) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key !== key) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (ignoreWhenTyping && key !== 'Escape') {
        const target = event.target as HTMLElement | null;
        const tag = target?.tagName;
        const isTyping =
          tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable;
        if (isTyping) return;
      }

      callback(event);
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, ignoreWhenTyping]);
}
