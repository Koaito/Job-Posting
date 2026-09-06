import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, isValidLocale } from "./config";

/**
 * getRequestConfig() của next-intl (chế độ KHÔNG dùng routing/middleware
 * riêng của next-intl — xem config.ts để biết lý do chọn cookie-based
 * thay vì locale-prefix). Đọc cookie `locale` set bởi
 * LanguageToggle.tsx (client) hoặc middleware.ts (lần đầu, mặc định
 * "vi") — KHÔNG đọc Accept-Language header, để tránh lệch giữa lần
 * request đầu (theo header trình duyệt) và lựa chọn thủ công sau đó.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const locale = isValidLocale(raw) ? raw : DEFAULT_LOCALE;

  const messages = (await import(`../messages/${locale}.json`)).default;

  return {
    locale,
    messages,
  };
});
