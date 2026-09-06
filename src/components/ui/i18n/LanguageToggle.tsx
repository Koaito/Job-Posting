'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { LOCALE_COOKIE_NAME, LOCALES, type Locale } from '@/i18n/config';

// Đặt NGOÀI component — eslint react-hooks/immutability hiểu nhầm
// `document.cookie = ...` gọi trực tiếp trong component là "sửa biến
// định nghĩa ngoài component" (false positive với global object property
// assignment); tách thành hàm module-level thuần tuý để tránh cảnh báo,
// không đổi hành vi.
function setLocaleCookie(next: Locale) {
  document.cookie = `${LOCALE_COOKIE_NAME}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

/**
 * LanguageToggle — Giai đoạn 2 (i18n, 09/2026).
 *
 * Đổi cookie `locale` (client-side, document.cookie — không cần gọi
 * Server Action riêng vì đây chỉ là 1 giá trị đơn giản, không nhạy
 * cảm) rồi router.refresh() để MỌI server component (kể cả
 * src/i18n/request.ts đọc cookie qua next/headers) render lại với
 * locale mới. KHÔNG đổi URL (xem src/i18n/config.ts) — router.refresh()
 * giữ nguyên pathname hiện tại, không điều hướng đi đâu cả.
 *
 * useTransition() để nút không "đứng hình" trong lúc chờ RSC re-fetch
 * (Next.js 16 có thể mất 1 nhịp mạng cho server component tree).
 */
export function LanguageToggle() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('languageToggle');
  const [isPending, startTransition] = useTransition();

  const setLocale = (next: Locale) => {
    if (next === locale) return;
    setLocaleCookie(next);
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="lang-toggle" aria-label={t('label')} data-pending={isPending || undefined}>
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          className={code === locale ? 'lang-toggle-btn active' : 'lang-toggle-btn'}
          onClick={() => setLocale(code)}
          disabled={isPending}
          aria-current={code === locale}
        >
          {t(code)}
        </button>
      ))}
    </div>
  );
}
