import type { MaintenanceJobType } from '@/types/crawl';

/**
 * Metadata 5 job bảo trì dữ liệu — KHÔNG có endpoint backend nào trả
 * sẵn nhãn/mô tả tiếng Việt cho các job này (api/schemas/maintenance.py
 * chỉ có MAINTENANCE_JOB_TYPES dạng tuple string dùng để validate), nên
 * frontend giữ 1 bản tĩnh, đúng 1:1 với crawler_client/maintenance.py
 * (mindx-jobs/Flask, MAINTENANCE_JOBS) — nguồn nhãn hiển thị gốc.
 *
 * THÊM 09/2026 (rà soát #3, chat139) — tab "Bảo trì dữ liệu" ở /crawl.
 */
export interface MaintenanceJobMeta {
  jobType: MaintenanceJobType;
  label: string;
  description: string;
  costsMoney: boolean;
  supportsDryRun?: boolean;
}

export const MAINTENANCE_JOBS: MaintenanceJobMeta[] = [
  {
    jobType: 'backfill_company_profiles',
    label: 'Vá hồ sơ công ty',
    description:
      'Vá industry, company_size, address, website (kèm products_services) — đọc lại đúng trang nguồn đã lưu (source_profile_url). Miễn phí, chỉ tốn thời gian chờ.',
    costsMoney: false,
  },
  {
    jobType: 'enrich_profile_from_website',
    label: 'Tra cứu từ website công ty',
    description:
      'Vá industry, products_services — đọc companies.website + 1 lần gọi Gemini/công ty để phân loại. Chi phí rẻ (không dùng Tavily).',
    costsMoney: false,
  },
  {
    jobType: 'enrich_web_info',
    label: 'Tra cứu web (Tavily + Gemini)',
    description:
      'Vá website, tax_id — Tavily search (2 query/công ty) + Gemini trích xuất. TỐN PHÍ THẬT, tốn nhất trong 5 job — chỉ nên chạy cho công ty chưa có source_profile_url.',
    costsMoney: true,
  },
  {
    jobType: 'get_fb_linkedin',
    label: 'Tìm Facebook/LinkedIn công ty',
    description:
      'Vá fanpage_url, linkedin_url — đọc companies.website (crawl HTML thô). Miễn phí, nhưng giới hạn với site dạng SPA/React (render bằng JS).',
    costsMoney: false,
  },
  {
    jobType: 'check_expired_jobs',
    label: 'Dọn job hết hạn',
    description:
      'Kiểm tra deadline + kiểm tra link job còn sống không, tự đóng job đã hết hạn/nguồn đã gỡ.',
    costsMoney: false,
    supportsDryRun: true,
  },
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

export function maintenanceJobLabel(jobType: string): string {
  return MAINTENANCE_JOBS.find((j) => j.jobType === jobType)?.label || jobType;
}
