/**
 * User/account types — bám đúng api/schemas/auth.py (backend FastAPI thật).
 *
 * Trước đây KHÔNG tồn tại file này (types/auth.ts cũ đã bị xoá vì bịa field
 * id:number/role enum cố định, xem comment cũ ở types/index.ts). Thêm lại
 * đúng theo UserOut/UserCreateByAdmin/UserRoleUpdate/UserActiveStatusUpdate
 * — dùng cho actions/staff.ts và actions/students.ts (route GET /auth/users
 * trả CHUNG 1 danh sách mọi role, 2 trang "Nhân viên"/"Học viên" chỉ lọc
 * theo role khác nhau ở tầng FE, không có 2 endpoint riêng).
 */

/** Khớp UserOut — GET /auth/me, GET /auth/users (KHÔNG BAO GIỜ có password_hash). */
export interface User {
  ss_user_id: string;
  full_name: string;
  email: string;
  role: string; // "user" | "ss_team" | "admin"
  is_active: boolean;
  must_change_password: boolean;
  last_login_at?: string | null;
  created_at: string;
  /** Chỉ có ý nghĩa với role='user' (học viên) — luôn null với ss_team/admin. */
  phone?: string | null;
}

/** Khớp UserCreateByAdmin (extra="forbid") — POST /auth/users (admin-only). */
export interface UserCreatePayload {
  full_name: string;
  email: string;
  role: string; // "user" | "ss_team" | "admin"
}

/** Khớp UserCreatedOut — response POST /auth/users, temp_password CHỈ trả 1 lần duy nhất. */
export interface UserCreated extends User {
  temp_password: string;
}

/** Khớp UserRoleUpdate (extra="forbid") — PATCH /auth/users/{id}/role (admin-only). */
export interface UserRolePayload {
  role: string;
}

/** Khớp UserActiveStatusUpdate (extra="forbid") — PATCH /auth/users/{id}/active-status (admin-only). */
export interface UserActiveStatusPayload {
  is_active: boolean;
}

/** Khớp JobApplicationOut — GET /auth/users/{id}/applications, GET /me/applications. */
export interface JobApplication {
  application_id: string;
  ss_user_id: string;
  job_id: string;
  note?: string | null;
  applied_at: string;
  job_title: string;
  job_status?: string | null;
  company_name: string;
  cv_url?: string | null;
}

/** Khớp SavedJobOut — GET /auth/users/{id}/saved-jobs, GET /me/saved-jobs. */
export interface SavedJob {
  saved_job_id: string;
  ss_user_id: string;
  job_id: string;
  created_at: string;
  job_title: string;
  job_status?: string | null;
  company_name: string;
}
