import type { NextConfig } from "next";
import createBundleAnalyzer from "@next/bundle-analyzer";
import createNextIntlPlugin from "next-intl/plugin";

// i18n (Giai đoạn 2, 09/2026) — trỏ vào src/i18n/request.ts, nơi đọc
// cookie `locale` (KHÔNG dùng locale-prefix URL, xem src/i18n/config.ts
// để biết lý do).
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Bundle analysis (mục 6.7 Performance Optimization, plan_nextjs.md).
// Bật bằng `npm run build:analyze` — mặc định tắt, không ảnh hưởng
// build/dev bình thường.
//
// BUG FIX (audit 09/2026 "rà toàn bộ codebase"): `@next/bundle-analyzer`
// KHÔNG chạy được với Turbopack ("The Next Bundle Analyzer is not
// compatible with Turbopack builds, no report will be generated." — tự
// Next.js in ra, đã verify bằng `ANALYZE=true next build` thật) — mà
// Next.js 16 mặc định build bằng Turbopack. `npm run build:analyze`
// (package.json) vì vậy PHẢI thêm cờ `--webpack` để `next build` build
// bằng webpack cho riêng lần chạy phân tích này, nếu không lệnh chạy
// xong (exit 0, KHÔNG báo lỗi gì) nhưng không sinh báo cáo nào — im
// lặng vô dụng, dễ tưởng nhầm là "đã đo rồi".
const withBundleAnalyzer = createBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  /* config options here */
};

// BUG FIX (audit 09/2026 "rà toàn bộ codebase"): thứ tự compose trước đây
// là withNextIntl(withBundleAnalyzer(nextConfig)) — ngược với
// plan_language_polish.md đã chốt (withBundleAnalyzer NGOÀI CÙNG, áp
// dụng sau cùng, để bundle analyzer đo được đúng bundle CUỐI CÙNG sau
// khi next-intl đã chèn xong webpack alias/loader cho file dịch, không
// đo nhầm bundle "trước khi" next-intl chèn thêm gì). Build/test vẫn
// pass ở thứ tự cũ (2 plugin không đụng chung 1 phần config) nên đây
// không phải bug chức năng đang gây lỗi thật — chỉ sửa lại cho khớp
// quyết định đã ghi trong plan, tránh lệch tài liệu về sau.
export default withBundleAnalyzer(withNextIntl(nextConfig));
