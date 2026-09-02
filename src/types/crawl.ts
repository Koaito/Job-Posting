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
