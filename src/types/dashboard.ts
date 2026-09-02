/**
 * Dashboard/stats types — bám đúng api/schemas/stats.py (backend FastAPI thật).
 *
 * BUG FIX (audit 09/2026): file này trước đây tự bịa field (total_contacts,
 * active_crawls, recent_jobs, RecentActivity với entity_id: number) không
 * khớp response thật của GET /stats. actions/dashboard.ts::getDashboardStats()
 * đã tự khai 1 interface DashboardStats RIÊNG, ĐÚNG (dạng đã map gọn cho
 * 6 KPI card) — KHÔNG đổi file đó. Types ở đây là bản RAW nguyên response
 * backend (StatsOut/EngagementStatsOut), dùng khi cần dữ liệu đầy đủ hơn
 * 6 KPI hiện tại (vd by_industry/by_source/jobs_by_status, hoặc tab
 * "Gợi ý học viên"/"Báo cáo tháng" ở Phase sau).
 */

export interface IndustryCount {
  matching_industry: string;
  n: number;
}

export interface SourceCount {
  source_name: string;
  n: number;
}

/** Khớp StatsOut — GET /stats (raw, đầy đủ). */
export interface StatsOut {
  total_jobs: number;
  total_companies: number;
  companies_with_social: number;
  by_industry: IndustryCount[];
  by_source: SourceCount[];
  total_applications: number;
  total_saved_jobs: number;
  /** Key = job_status ("OPEN"/"CLOSED"), value = số lượng. */
  jobs_by_status: Record<string, number>;
  /** role='user' — học viên đã đăng ký. */
  total_students: number;
}

/** Khớp JobEngagementOut — 1 dòng trong GET /stats/engagement::jobs. */
export interface JobEngagement {
  job_id: string;
  job_title: string;
  deadline?: string | null;
  created_at?: string | null;
  application_count: number;
  saved_count: number;
}

export interface MonthlyCount {
  this_month: number;
  last_month: number;
}

export interface MonthlyEngagement {
  applications: MonthlyCount;
  saved_jobs: MonthlyCount;
}

/** Khớp EngagementStatsOut — GET /stats/engagement. */
export interface EngagementStats {
  jobs: JobEngagement[];
  monthly: MonthlyEngagement;
}
