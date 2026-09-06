import type { NextConfig } from "next";
import createBundleAnalyzer from "@next/bundle-analyzer";
import createNextIntlPlugin from "next-intl/plugin";

// i18n (Giai đoạn 2, 09/2026) — trỏ vào src/i18n/request.ts, nơi đọc
// cookie `locale` (KHÔNG dùng locale-prefix URL, xem src/i18n/config.ts
// để biết lý do).
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Bundle analysis (mục 6.7 Performance Optimization, plan_nextjs.md).
// Bật bằng `ANALYZE=true npm run build` — mặc định tắt, không ảnh
// hưởng build/dev bình thường.
const withBundleAnalyzer = createBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  /* config options here */
};

export default withNextIntl(withBundleAnalyzer(nextConfig));
