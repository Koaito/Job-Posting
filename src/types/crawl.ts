/**
 * Crawler types — bám đúng api/schemas/crawl.py (backend FastAPI thật).
 *
 * BUG FIX (audit 09/2026): file này trước đây tự bịa field
 * (is_running/current_source/jobs_found/CrawlHistory với id: number)
 * không khớp response thật — chưa gây lỗi runtime vì actions/crawl.ts
 * còn là stub. Viết lại đúng theo CrawlStatusOut/CrawlRequest/
 * CrawlBatch* trước khi code module này (Phase sau, chỉ role admin).
 */

/** Khớp CrawlRequest (extra="forbid") — POST /crawl. */
export interface CrawlTriggerPayload {
  source: string; // vd "topcv" | "vietnamworks" | "careerviet"
  category: string; // vd "data-analyst" | "data-engineer" | "software-engineering"
  pages?: number;
  max_jobs?: number;
}

/** Khớp CrawlAccepted — response ngay khi POST /crawl (202 Accepted). */
export interface CrawlAccepted {
  run_id: string;
  status: string; // "queued" | "running" | "done" | "error"
}

/** Khớp CrawlStatusOut — GET /crawl/{run_id}, và từng item trong list. */
export interface CrawlStatus {
  run_id: string;
  status: string; // "queued" | "running" | "done" | "error"
  source: string;
  category: string;
  pages: number;
  max_jobs?: number | null;
  triggered_by?: string | null;
  triggered_by_name?: string | null;
  started_at: string;
  finished_at?: string | null;
  stats?: Record<string, unknown> | null;
  error?: string | null;
  /** Snapshot tiến độ mới nhất trong lúc status='running'. */
  progress?: { fetched: number; inserted: number; last_update: string } | null;
  batch_id?: string | null;
  batch_position?: number | null;
}

/** Khớp query param thật của GET /crawl (lịch sử crawl). */
export interface CrawlHistoryFilters {
  source?: string;
  status?: string;
  triggered_by?: string;
  limit?: number;
  offset?: number;
}

export interface PaginatedCrawlRuns {
  total: number;
  limit: number;
  offset: number;
  items: CrawlStatus[];
}

/** Khớp CrawlLogOut/CrawlLogsOut — GET /crawl/{run_id}/logs (poll live). */
export interface CrawlLog {
  id: number;
  level: string;
  message: string;
  created_at: string;
}

export interface CrawlLogsResponse {
  /** id lớn nhất trong "items" — dùng làm after_id cho lần poll kế tiếp. */
  last_id: number;
  items: CrawlLog[];
}

/** Khớp CrawlBatchRequest (extra="forbid") — POST /crawl/batch. */
export interface CrawlBatchTriggerPayload {
  source: string;
  categories: string[];
  pages?: number;
  max_jobs?: number;
}

/** Khớp CrawlBatchAccepted — response ngay khi POST /crawl/batch. */
export interface CrawlBatchAccepted {
  batch_id: string;
  first_run_id: string;
  status: string; // "running"
}

/** Khớp CrawlBatchStatusOut — GET /crawl/batch/{batch_id} (đầy đủ, kèm items). */
export interface CrawlBatchStatus {
  batch_id: string;
  source: string;
  categories: string[];
  pages: number;
  max_jobs?: number | null;
  status: string; // "running" | "done" | "error"
  error?: string | null;
  triggered_by?: string | null;
  triggered_by_name?: string | null;
  created_at: string;
  finished_at?: string | null;
  total: number;
  completed: number;
  items: CrawlStatus[];
}

/** Khớp CrawlBatchSummaryOut — GET /crawl/batch (danh sách batch, không kèm items). */
export interface CrawlBatchSummary {
  batch_id: string;
  source: string;
  categories: string[];
  pages: number;
  max_jobs?: number | null;
  status: string;
  error?: string | null;
  triggered_by?: string | null;
  triggered_by_name?: string | null;
  created_at: string;
  finished_at?: string | null;
}

export interface PaginatedCrawlBatches {
  total: number;
  limit: number;
  offset: number;
  items: CrawlBatchSummary[];
}

/**
 * THÊM 09/2026 (rà soát #3, chat139) — trước đây chỉ có types cho crawl
 * nguồn ngoài. Giờ thêm tab "status" (Tình trạng dữ liệu) + "maintenance"
 * (Bảo trì dữ liệu) + "history" (Lịch sử vận hành) của trang /crawl,
 * bám đúng api/schemas/companies.py::FieldHealthRow/CompanyDataHealth và
 * api/schemas/jobs.py::JobHealthRow/JobHealthListItem/JobHealthBySource/
 * DuplicateJobGroup/JobDataHealth + api/schemas/maintenance.py.
 */

/** Khớp FieldHealthRow (dùng chung cho cả company và job data-health). */
export interface FieldHealthRow {
  field: string;
  label: string;
  missing: number;
  total: number;
  pct_missing: number;
}

/** Khớp CompanyDataHealth — GET /companies/data-health. */
export interface CompanyDataHealth {
  company_health_rows: FieldHealthRow[];
  company_health_total: number;
  company_no_contact_missing: number;
  company_no_contact_total: number;
}

/** Khớp JobHealthListItem — 1 job rút gọn trong expired_open_jobs/duplicate_job_groups[].jobs. */
export interface JobHealthListItem {
  id: string;
  position: string;
  company: string;
  deadline?: string | null;
  source: string;
  /** THÊM ở frontend (không có ở backend) — gán tại chỗ cho duplicate_job_groups,
   * xem crawl_status.py::_annotate_duplicate_keep_suggestion() bên Flask gốc:
   * true = job này nên giữ (deadline xa nhất trong nhóm), false = job khác nên
   * giữ, null/undefined = không đủ căn cứ (không hiện badge gì). */
  suggest_keep?: boolean | null;
}

export interface JobHealthBySource {
  source: string;
  total: number;
  rows: FieldHealthRow[];
}

export interface DuplicateJobGroup {
  company: string;
  position: string;
  jobs: JobHealthListItem[];
}

/** Khớp JobDataHealth — GET /jobs/data-health. */
export interface JobDataHealth {
  job_health_rows: FieldHealthRow[];
  job_health_total: number;
  expired_open_jobs: JobHealthListItem[];
  job_health_by_source: JobHealthBySource[];
  duplicate_job_groups: DuplicateJobGroup[];
}

/** Khớp 5 job_type ở MAINTENANCE_JOB_TYPES (api/schemas/maintenance.py). */
export type MaintenanceJobType =
  | 'backfill_company_profiles'
  | 'enrich_profile_from_website'
  | 'enrich_web_info'
  | 'get_fb_linkedin'
  | 'check_expired_jobs';

/** Khớp MaintenanceRunRequest — POST /maintenance/{job_type}. */
export interface MaintenanceRunPayload {
  limit?: number;
  dry_run?: boolean;
  check_deadline_only?: boolean;
}

/** Khớp MaintenanceAccepted. */
export interface MaintenanceAccepted {
  run_id: string;
  job_type: string;
  status: string; // "queued"
}

/** Khớp MaintenanceStatusOut — GET /maintenance/{run_id}, và từng item trong list. */
export interface MaintenanceStatus {
  run_id: string;
  job_type: string;
  params: Record<string, unknown>;
  status: string; // "queued" | "running" | "done" | "error"
  stats?: Record<string, unknown> | null;
  error?: string | null;
  triggered_by?: string | null;
  triggered_by_name?: string | null;
  started_at: string;
  finished_at?: string | null;
}

/** Khớp query param thật của GET /maintenance (lịch sử bảo trì). */
export interface MaintenanceHistoryFilters {
  job_type?: string;
  status?: string;
  triggered_by?: string;
  limit?: number;
  offset?: number;
}

export interface PaginatedMaintenanceRuns {
  total: number;
  limit: number;
  offset: number;
  items: MaintenanceStatus[];
}

/** Khớp MaintenanceLogOut/MaintenanceLogsOut — GET /maintenance/{run_id}/logs. */
export interface MaintenanceLog {
  id: number;
  level: string;
  message: string;
  created_at: string;
}

export interface MaintenanceLogsResponse {
  last_id: number;
  items: MaintenanceLog[];
}
