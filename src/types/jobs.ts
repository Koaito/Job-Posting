/**
 * Job types — bám đúng api/schemas/jobs.py (backend FastAPI thật).
 *
 * BUG FIX (audit 09/2026): file này trước đây tự bịa field (id: number,
 * title, company_id: number, status: 'active'|'inactive'|'closed')
 * hoàn toàn không khớp response thật, và không được actions/jobs.ts sử
 * dụng (file đó tự khai interface Job riêng, đúng hơn). Viết lại đúng
 * theo JobOut/JobDetailOut/JobCreate/JobUpdate — dùng làm tham chiếu
 * chuẩn cho các trang/module sau này cần import type Job (vd trang
 * chi tiết company hiện CompanyDetailOut.jobs).
 */

export interface ParsedContent {
  job_description?: string | null;
  requirements?: string | null;
  perks?: string | null;
  required_skills?: string[] | null;
}

/** Khớp JobOut — dùng cho GET /jobs (list) và field chung của detail. */
export interface Job {
  job_id: string;
  job_title: string;
  matching_industry?: string | null;
  work_type?: string | null; // FULL_TIME | PART_TIME | INTERNSHIP | OTHER
  currency?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_type?: string | null; // RANGE | EXACT | UPTO | STARTING_FROM | NEGOTIABLE | UNPAID
  salary_period?: string | null; // MONTH | YEAR
  deadline?: string | null;
  job_status: string; // OPEN | CLOSED
  source_url?: string | null;
  source_name?: string | null; // TopCV | VietnamWorks | CareerViet | MANUAL
  company_id: string;
  company_name: string;
  level_code?: string | null; // Intern | Fresher | Junior | Middle | Senior | Lead | Manager
  province_name?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  /** Chỉ có giá trị khi GET /jobs gọi kèm include_content=true, mặc định null. */
  parsed_content?: ParsedContent | null;
}

/** Khớp JobDetailOut — dùng cho GET /jobs/{job_id} (thêm ss_team_notes). */
export interface JobDetail extends Job {
  ss_team_notes?: string | null;
}

/**
 * Khớp query param thật của GET /jobs (api/routers/jobs.py::list_jobs).
 * KHÔNG có company_id (route này không hỗ trợ lọc theo công ty).
 */
export interface JobFilters {
  industry?: string;
  province?: string;
  level?: string;
  work_type?: string;
  status?: string;
  keyword?: string;
  created_by?: string;
  include_content?: boolean;
  limit?: number;
  offset?: number;
}

/** Khớp JobCreate (model_config extra="forbid") — POST /jobs. */
export interface JobCreatePayload {
  job_title: string;
  company_id: string;
  matching_industry?: string | null;
  level_code?: string | null;
  province_name?: string | null;
  work_type?: string | null;
  currency?: string;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_type?: string;
  salary_period?: string;
  deadline?: string | null;
  parsed_content?: ParsedContent | null;
}

/**
 * Khớp JobUpdate (model_config extra="forbid") — PATCH /jobs/{job_id}.
 * Mọi field optional; job_status='CLOSED' = "xoá mềm". KHÁC JobCreate:
 * có thêm job_status/ss_team_notes/note, KHÔNG có trong JobCreate.
 */
export interface JobUpdatePayload {
  job_title?: string;
  matching_industry?: string | null;
  level_code?: string | null;
  province_name?: string | null;
  work_type?: string | null;
  currency?: string;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_type?: string;
  salary_period?: string;
  deadline?: string | null;
  job_status?: string;
  ss_team_notes?: string | null;
  parsed_content?: ParsedContent | null;
  /** Ghi chú lý do sửa cho audit_logs — tuỳ chọn. */
  note?: string;
}

export interface PaginatedJobs {
  total: number;
  limit: number;
  offset: number;
  items: Job[];
}
