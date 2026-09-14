/**
 * Types cho Dashboard — khớp response GET /stats (FastAPI).
 *
 * REFACTOR (audit 09/2026, "Đánh giá kiến trúc" #6): mọi domain khác
 * (auth, companies, contacts, crawl, email-templates, import-export,
 * jobs, messages) đều có file riêng trong src/types/, nhưng DashboardStats
 * trước đây khai INLINE ngay trong actions/dashboard.ts — phá vỡ
 * convention nhất quán của codebase.
 *
 * LƯU Ý: types/dashboard.ts CŨ đã bị xoá đúng ở đợt cleanup trước (dead
 * code thật — 7 interface không liên quan tới DashboardStats này), việc
 * xoá đó không sai; chỉ là từ đó thiếu hẳn 1 file đúng nghĩa cho domain
 * dashboard. File này tạo lại, CHỈ chứa đúng DashboardStats (không mang
 * lại 7 interface dead code cũ).
 */
export interface DashboardStats {
  total_jobs: number;
  total_companies: number;
  /** Job đang còn tuyển (status = OPEN) — suy ra từ jobs_by_status.OPEN. */
  jobs_open: number;
  total_students: number | null;
  total_applications: number;
  total_saved_jobs: number;
}

/**
 * Shape thô GET /stats trả về trước khi actions/dashboard.ts rút gọn
 * thành DashboardStats — giữ tối thiểu field cần đọc, không map 1:1
 * toàn bộ response backend (backend có thể trả thêm field khác chưa
 * dùng tới ở FE).
 */
export interface DashboardStatsRaw {
  total_jobs?: number;
  total_companies?: number;
  jobs_by_status?: Record<string, number>;
  total_students?: number | null;
  total_applications?: number;
  total_saved_jobs?: number;
}
