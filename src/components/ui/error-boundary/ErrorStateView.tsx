import Link from 'next/link';
import { GoBackButton } from './GoBackButton';

/**
 * Khớp 1:1 markup Flask `templates/error.html` (dùng chung cho
 * 400/403/404/500, xem app.py — tone "muted"/"warn"/"danger" tương ứng
 * mức độ nghiêm trọng, KHÔNG phải màu cố định theo mã lỗi).
 *
 * Trước đợt này, Next.js có 2 nơi tự vẽ UI "lỗi" khác nhau, đều lệch
 * khỏi bản Flask:
 *  - `notFound()` (jobs/[id], companies/[id], students/[id]...) không
 *    có `not-found.tsx` nào cả -> rơi về trang 404 mặc định xấu của
 *    Next.js, không dùng `.error-page`/`error-code--muted`.
 *  - `RequireRole` (chặn quyền staff/admin, tương đương 403) tự vẽ
 *    bằng `.empty-state` chung chung, không phải `.error-page`/
 *    `error-code--warn` như Flask.
 *
 * Component này gom lại UI dùng chung cho cả 2 chỗ trên (xem
 * `src/app/not-found.tsx` và `RequireRole.tsx`).
 */
export function ErrorStateView({
  eyebrow,
  code,
  tone,
  chipLabel,
  title,
  message,
  primaryHref,
  primaryLabel,
  backLabel,
}: {
  eyebrow: string;
  /** Số/ký hiệu hiển thị to — "404", "403"... (Flask dùng `{{ code }}`). */
  code: string;
  tone: 'muted' | 'warn' | 'danger';
  chipLabel: string;
  title: string;
  message: string;
  /** Nút hành động chính — mặc định về /jobs, giống Flask `url_for('jobs.index')`. */
  primaryHref?: string;
  primaryLabel: string;
  backLabel: string;
}) {
  const homeHref = primaryHref ?? '/jobs';

  return (
    <div className="error-page">
      <span className="eyebrow">{eyebrow}</span>
      <div className={`error-code error-code--${tone}`}>{code}</div>
      <span className={`error-chip error-chip--${tone}`}>{chipLabel}</span>
      <h1>{title}</h1>
      <p className="lede">{message}</p>

      <div className="error-actions">
        <Link className="btn btn-primary" href={homeHref}>
          {primaryLabel}
        </Link>
        <GoBackButton label={backLabel} fallbackHref={homeHref} />
      </div>
    </div>
  );
}
