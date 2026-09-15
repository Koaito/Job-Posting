'use client';

/**
 * Nút "← Quay lại" dùng chung cho not-found.tsx / RequireRole (403) —
 * khớp hành vi nút tương ứng trong Flask templates/error.html:
 * `onclick="if (document.referrer) { history.back(); } else { ... }"`.
 * Tách thành 1 client component nhỏ (thay vì để cả ErrorStateView là
 * client) để not-found.tsx/RequireRole vẫn có thể là server component
 * bình thường, chỉ mỗi cái nút này cần JS.
 */
export function GoBackButton({
  label,
  fallbackHref,
}: {
  label: string;
  fallbackHref: string;
}) {
  return (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={() => {
        if (document.referrer) {
          history.back();
        } else {
          window.location.href = fallbackHref;
        }
      }}
    >
      {label}
    </button>
  );
}
