'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Bật/tắt giao diện tối — Preferences (BỔ SUNG 09/2026, đặt ở
 * `/profile`, xem mục 6.5 plan_nextjs.md). Flask gốc KHÔNG có tính
 * năng này (đã xác nhận: không route/field nào tên theme/dark-mode ở
 * cả `mindx-jobs` lẫn `Scrap JD`) — đây là tính năng MỚI cho Next.js,
 * không phải port.
 *
 * 3 lựa chọn, lưu `localStorage["theme"]`: "light" | "dark" | "system"
 * (mặc định — coi như key không tồn tại, tự theo
 * `prefers-color-scheme` của hệ điều hành). Đồng bộ với script
 * anti-FOUC ở `app/layout.tsx` (set `data-theme` trên `<html>` TRƯỚC
 * paint để không nháy sáng/tối 1 nhịp lúc tải trang) — cùng cơ chế
 * với `sidebar-collapsed` (`components/ui/layout/Sidebar.tsx`), chỉ
 * khác dùng `data-theme` attribute thay vì class vì có 3 trạng thái
 * chứ không phải bật/tắt nhị phân.
 *
 * Đọc giá trị hiện tại từ chính attribute `data-theme` trên `<html>`
 * (đã được script anti-FOUC set sẵn trước khi component này mount)
 * thay vì tự đọc lại `localStorage` — 1 nguồn sự thật duy nhất, tránh
 * lệch nếu 2 nơi đọc/ghi khác thời điểm.
 *
 * i18n (Giai đoạn 2, nhóm 5, 09/2026): nhãn + aria-label dịch qua
 * useTranslations('themeToggle'). "Language" (phần còn lại của mục
 * Preferences) đã có ở LanguageToggle.tsx riêng, không liên quan file
 * này.
 */
type ThemeChoice = 'light' | 'dark' | 'system';

const OPTION_KEYS: ThemeChoice[] = ['light', 'dark', 'system'];

function applyTheme(choice: ThemeChoice) {
  if (choice === 'system') {
    document.documentElement.removeAttribute('data-theme');
    try {
      localStorage.removeItem('theme');
    } catch {
      // localStorage bị chặn (chế độ ẩn danh nghiêm ngặt...) — bỏ qua,
      // theme vẫn áp dụng đúng cho phiên hiện tại, chỉ không nhớ lại
      // lần sau (giống hệt cách Sidebar.tsx xử lý lỗi này).
    }
    return;
  }
  document.documentElement.setAttribute('data-theme', choice);
  try {
    localStorage.setItem('theme', choice);
  } catch {
    // Xem chú thích ở nhánh 'system' phía trên.
  }
}

export default function ThemeToggle() {
  const t = useTranslations('themeToggle');
  // Đọc thẳng attribute đã gắn SẴN trên <html> — set sớm bằng inline
  // <script> trong <head> (root layout.tsx, TRƯỚC khi React hydrate,
  // tránh nháy sáng/tối 1 nhịp). Dùng lazy initializer (không phải
  // useEffect) — cùng lý do/pattern hệt `collapsed` ở Sidebar.tsx
  // (react-hooks/set-state-in-effect). typeof document === 'undefined'
  // che cho lượt render đầu trên server (SSR không có DOM/localStorage)
  // — SSR luôn không biết trước lựa chọn đã lưu của trình duyệt, nên 3
  // nút bên dưới có suppressHydrationWarning, y hệt nút thu gọn sidebar.
  const [active, setActive] = useState<ThemeChoice>(() => {
    if (typeof document === 'undefined') return 'system';
    const attr = document.documentElement.getAttribute('data-theme');
    return attr === 'light' || attr === 'dark' ? attr : 'system';
  });

  // Component này render bên trong 1 Server Component cha
  // (`profile/page.tsx`) nên lần render đầu trên SERVER không có
  // `document` — useState lazy init ở trên chỉ thật sự chạy trên
  // CLIENT (sau hydrate) nên không lệch giữa server/client HTML.

  return (
    <nav className="tab-bar" aria-label={t('ariaLabel')}>
      {OPTION_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          className={active === key ? 'active' : ''}
          suppressHydrationWarning
          onClick={() => {
            applyTheme(key);
            setActive(key);
          }}
        >
          {t(key)}
        </button>
      ))}
    </nav>
  );
}
