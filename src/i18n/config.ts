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

/**
 * Map locale ngắn của next-intl ("vi"/"en" — xem LOCALES ở trên) sang mã
 * BCP-47 đầy đủ mà `Intl`/`Date#toLocaleDateString`/`Date#toLocaleString`
 * cần (Polish, 09/2026) — trước đây gọi thẳng `'vi-VN'` hard-code ở ~25
 * chỗ/16 file, khiến ngày giờ luôn hiện định dạng Việt kể cả khi UI đã ở
 * locale=en. Đặt tên `INTL_LOCALE_MAP` (không phải `DATE_LOCALE_MAP`) vì
 * cùng map này dùng được cho mọi API `Intl.*` khác nếu cần sau này, không
 * riêng ngày giờ.
 */
export const INTL_LOCALE_MAP: Record<Locale, string> = {
  vi: "vi-VN",
  en: "en-US",
};

/** Tiện ích 1 dòng — dùng ở mọi Server/Client Component cần format ngày giờ.
 * Nhận `string` (không phải `Locale` hẹp) vì `getLocale()`/`useLocale()`
 * của next-intl trả về kiểu `string` thuần — tự validate lại bằng
 * `isValidLocale()` ở đây, fallback `DEFAULT_LOCALE` nếu gặp giá trị lạ
 * (không nên xảy ra trên thực tế vì `i18n/request.ts` đã validate từ
 * cookie, nhưng an toàn hơn là ép kiểu thẳng tay). */
export function toIntlLocale(locale: string): string {
  return INTL_LOCALE_MAP[isValidLocale(locale) ? locale : DEFAULT_LOCALE];
}
