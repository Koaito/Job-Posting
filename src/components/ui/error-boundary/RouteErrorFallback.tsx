'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

/**
 * B.2 Polish (mục 6.6, 09/2026) — dùng CHUNG cho mọi `error.tsx` theo
 * route. Next.js YÊU CẦU `error.tsx` là Client Component (nhận
 * `error`/`reset` qua props, không phải children như layout thường) —
 * next-intl vẫn dùng được vì `NextIntlClientProvider` đã bọc quanh
 * toàn app ở layout.tsx (root), không phải lo thêm setup riêng.
 *
 * Tái dùng ĐÚNG bộ class `.error-page`/`.error-code`/`.error-chip`/
 * `.error-actions` đã có sẵn ở `17-error-pages.css` — bộ class này vốn
 * dựng cho trang lỗi HTTP kiểu Flask (404/403/500, xem
 * `mindx-jobs/templates/error.html`), CÙNG Ý NGHĨA thị giác với error
 * boundary Next.js (khối lỗi to, giữa trang, có nút hành động) — đúng
 * nguyên tắc "không tự bịa màu/style mới" đã ghi trong plan Polish.
 * Dùng tone `--danger` (không phải `--muted`/`--warn`) vì đây LUÔN là
 * lỗi runtime thật sự (khác 404 "không tìm thấy" — chỉ là thiếu nội
 * dung, không phải hỏng gì).
 *
 * Hành động "Thử lại" gọi `reset()` do Next.js cấp — thử render lại
 * đúng segment bị lỗi, KHÔNG phải `history.back()` như bản Flask gốc
 * (bản gốc là trang lỗi HTTP toàn trang, còn đây là error boundary chỉ
 * bọc 1 segment, "thử lại" mới là hành động đúng ngữ cảnh).
 */

interface RouteErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** Trang về khi user không muốn "thử lại" nữa. Mặc định /dashboard. */
  homeHref?: string;
}

export function RouteErrorFallback({ error, reset, homeHref = '/dashboard' }: RouteErrorFallbackProps) {
  const t = useTranslations('errorBoundary');

  useEffect(() => {
    // Log lại lỗi thật ra console (kèm digest nếu Next.js có gắn, dùng
    // để tra log server) — error boundary nuốt mất stack trace khỏi
    // người dùng cuối theo đúng thiết kế, nhưng KHÔNG được nuốt luôn
    // khỏi console để còn cách debug khi có báo lỗi thật.
    console.error('[RouteErrorFallback]', error);
  }, [error]);

  return (
    <div className="error-page">
      <span className="eyebrow">{t('eyebrow')}</span>
      <div className="error-code error-code--danger">!</div>
      <span className="error-chip error-chip--danger">{t('chipLabel')}</span>
      <h1>{t('title')}</h1>
      <p className="lede">{t('message')}</p>

      <div className="error-actions">
        <button type="button" className="btn btn-primary" onClick={reset}>
          {t('retry')}
        </button>
        <Link className="btn btn-ghost" href={homeHref}>
          {t('goHome')}
        </Link>
      </div>
    </div>
  );
}
