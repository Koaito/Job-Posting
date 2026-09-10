import type { MaintenanceJobType } from '@/types/crawl';

/**
 * Metadata 5 job bảo trì dữ liệu — KHÔNG có endpoint backend nào trả
 * sẵn nhãn/mô tả cho các job này (api/schemas/maintenance.py chỉ có
 * MAINTENANCE_JOB_TYPES dạng tuple string dùng để validate), nên
 * frontend giữ 1 bản tĩnh, đúng 1:1 với crawler_client/maintenance.py
 * (mindx-jobs/Flask, MAINTENANCE_JOBS) — nguồn nhãn hiển thị gốc.
 *
 * THÊM 09/2026 (rà soát #3, chat139) — tab "Bảo trì dữ liệu" ở /crawl.
 *
 * i18n (đợt sau, 09/2026): `label`/`description` (trước đây hard-code
 * tiếng Việt ngay trong metadata) đã CHUYỂN sang namespace mới
 * `maintenanceJobs` trong messages/{vi,en}.json — key lồng theo đúng
 * `jobType` thật ('backfill_company_profiles.label',
 * 'backfill_company_profiles.description', ...), cùng pattern `roleLabel()`
 * (lib/auth/roles.ts) / `crawlStatusLabel()` (lib/crawl/badges.ts). Metadata
 * ở đây giờ CHỈ còn dữ liệu KHÔNG đổi theo locale (jobType, costsMoney,
 * supportsDryRun) — tách khỏi phần hiển thị.
 */
export interface MaintenanceJobMeta {
  jobType: MaintenanceJobType;
  costsMoney: boolean;
  supportsDryRun?: boolean;
}

export const MAINTENANCE_JOBS: MaintenanceJobMeta[] = [
  { jobType: 'backfill_company_profiles', costsMoney: false },
  { jobType: 'enrich_profile_from_website', costsMoney: false },
  { jobType: 'enrich_web_info', costsMoney: true },
  { jobType: 'get_fb_linkedin', costsMoney: false },
  { jobType: 'check_expired_jobs', costsMoney: false, supportsDryRun: true },
];

/**
 * Job BẮT BUỘC truyền "limit" khi trigger — khớp
 * MAINTENANCE_JOB_TYPES_REQUIRE_LIMIT (api/schemas/maintenance.py):
 * CHỈ "enrich_web_info" (gọi Tavily/Gemini tốn phí thật). "get_fb_linkedin"
 * KHÔNG nằm trong set này dù cũng đọc website ngoài — job đó miễn phí
 * (chỉ crawl HTML thô), không có rủi ro tốn phí khi để trống chạy hết.
 */
export const MAINTENANCE_JOB_TYPES_REQUIRE_LIMIT: ReadonlySet<string> = new Set([
  'enrich_web_info',
]);

/** Chỉ job_type này nhận dry_run/check_deadline_only. */
export const MAINTENANCE_CHECK_EXPIRED_JOB_TYPE: MaintenanceJobType = 'check_expired_jobs';

/**
 * `t` là `useTranslations('maintenanceJobs')` (Client Component) hoặc
 * `getTranslations('maintenanceJobs')` (Server Component) — cùng pattern
 * `roleLabel()`/`crawlStatusLabel()`. jobType lạ (ngoài 5 giá trị chuẩn)
 * fallback về chính jobType, không tra bảng (an toàn, không hiện lỗi
 * "MISSING_MESSAGE" của next-intl).
 */
export function maintenanceJobLabel(
  jobType: string,
  t: (key: string) => string
): string {
  return MAINTENANCE_JOBS.some((j) => j.jobType === jobType) ? t(`${jobType}.label`) : jobType;
}

/** Tương tự maintenanceJobLabel(), cho phần mô tả (description). */
export function maintenanceJobDescription(
  jobType: string,
  t: (key: string) => string
): string {
  return MAINTENANCE_JOBS.some((j) => j.jobType === jobType) ? t(`${jobType}.description`) : '';
}
