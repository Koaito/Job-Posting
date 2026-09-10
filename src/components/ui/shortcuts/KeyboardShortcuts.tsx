'use client';

import { useCallback } from 'react';
import { useKeyboardShortcut } from '@/lib/hooks/useKeyboardShortcut';

/**
 * B.4 Polish (mục 6.6, 09/2026) — scope tối thiểu đã chốt trong plan:
 * `/` focus ô tìm kiếm, `Esc` đóng modal/form đang mở. Mount ĐÚNG 1 lần
 * ở root layout.tsx (bọc mọi route) — không phải component hiển thị gì
 * (return null), chỉ gắn 2 global listener qua `useKeyboardShortcut`.
 *
 * Ô tìm kiếm: mọi trang danh sách (jobs/companies/contacts/students/
 * activity/staff-activity) đều dùng chung class `.filter-bar` (xem
 * 03-layout.css) với input tìm kiếm là `type="search"` (đa số) hoặc
 * `type="text"` (StaffActivityList.tsx) — KHÔNG phải `type="hidden"`
 * (activity/page.tsx, HistoryView.tsx có input ẩn đứng trước trong cùng
 * `.filter-bar`). Query cả 2 loại, lấy phần tử ĐẦU TIÊN khớp trên trang
 * hiện tại. Trang không có `.filter-bar` (VD /dashboard, /profile) thì
 * querySelector trả null — bỏ qua, không có gì để focus.
 */
export function KeyboardShortcuts() {
  const focusSearch = useCallback((event: KeyboardEvent) => {
    const input = document.querySelector<HTMLInputElement>(
      '.filter-bar input[type="search"], .filter-bar input[type="text"]'
    );
    if (!input) return;
    event.preventDefault();
    input.focus();
    input.select();
  }, []);

  const handleEscape = useCallback(() => {
    // Thoát khỏi ô đang gõ trước (nếu có) — Escape là cách quen thuộc
    // nhất để "bỏ ngang" 1 ô nhập.
    const active = document.activeElement as HTMLElement | null;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      active.blur();
    }

    // Đóng mọi <details open> — cơ chế popover có sẵn của app (VD
    // "Sửa nhanh tiềm năng" ở bảng công ty/PotentialQuickEdit.tsx, khối
    // lịch sử HistoryView.tsx). <details> gốc KHÔNG tự đóng khi Esc,
    // khác hẳn <dialog>, nên cần chủ động set `open = false`.
    document.querySelectorAll<HTMLDetailsElement>('details[open]').forEach((el) => {
      el.open = false;
    });
  }, []);

  useKeyboardShortcut('/', focusSearch);
  useKeyboardShortcut('Escape', handleEscape);

  return null;
}
