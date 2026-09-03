/**
 * Role helpers
 *
 * BUG FIX (audit 09/2026): FE trước đây dùng field "is_staff" (login/page.tsx,
 * Sidebar.tsx, actions/auth.ts) nhưng backend (schemas/auth.py::UserOut)
 * KHÔNG BAO GIỜ trả field này — chỉ có "role" ("user" | "ss_team" | "admin").
 * Vì "is_staff" luôn undefined ở runtime, staff/admin login xong bị đối xử
 * như student. Dùng hàm này ở mọi nơi cần biết "user có phải staff không"
 * thay vì field ảo.
 */
export function isStaffRole(role: string | undefined | null): boolean {
  return role === 'admin' || role === 'ss_team';
}

/**
 * Thêm (audit 09/2026 #13) — dùng ở trang /staff: 3 route ghi
 * (POST /auth/users, PATCH .../role, PATCH .../active-status) đều
 * require_admin ở backend, CHẶT hơn require_role("ss_team") của
 * GET /auth/users — ss_team xem được danh sách nhưng không tạo/sửa
 * được tài khoản người khác.
 */
export function isAdminRole(role: string | undefined | null): boolean {
  return role === 'admin';
}
