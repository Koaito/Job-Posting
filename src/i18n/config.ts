/**
 * Cấu hình i18n dùng chung — Giai đoạn 2 (kế hoạch i18n, 09/2026).
 *
 * QUYẾT ĐỊNH THIẾT KẾ: cookie-based, KHÔNG dùng locale-prefix URL
 * (không có /vi/jobs, /en/jobs) — lý do: middleware.ts hiện tại xử lý
 * auth dựa trên pathname thô (isProtectedPage/isAuthPage so khớp
 * pathname.startsWith('/jobs') v.v.). Nếu đổi sang locale-prefix URL,
 * mọi so khớp đó phải viết lại để bóc tách prefix trước, rủi ro vỡ
 * luồng auth đang chạy ổn định. Cookie-based tránh hoàn toàn việc đó —
 * middleware.ts CHỈ cần thêm 1 bước set cookie mặc định nếu chưa có
 * (xem middleware.ts), không đụng logic auth cũ.
 *
 * ĐÁNH ĐỔI đã chấp nhận: không có URL chia sẻ được kèm ngôn ngữ (vd
 * không thể gửi link "/en/jobs/123" cho đồng nghiệp dùng tiếng Anh) —
 * chấp nhận được vì đây là app nội bộ (SS team + admin), không phải
 * site public cần SEO đa ngôn ngữ.
 */
export const LOCALES = ["vi", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "vi";

/** Tên cookie lưu lựa chọn locale — đọc bởi middleware.ts + i18n/request.ts. */
export const LOCALE_COOKIE_NAME = "locale";

export function isValidLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
