import type { NextConfig } from "next";
import createBundleAnalyzer from "@next/bundle-analyzer";

// Bundle analysis (mục 6.7 Performance Optimization, plan_nextjs.md).
// Bật bằng `ANALYZE=true npm run build` — mặc định tắt, không ảnh
// hưởng build/dev bình thường.
const withBundleAnalyzer = createBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  /* config options here */
};

export default withBundleAnalyzer(nextConfig);
