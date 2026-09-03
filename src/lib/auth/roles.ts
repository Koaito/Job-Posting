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
 * Mới 09/2026 — dùng để ẩn/hiện nút tạo tài khoản, đổi role, khoá/mở
 * khoá ở trang /staff (backend require_admin cho cả 3 thao tác đó,
 * xem api/routers/auth_users.py — ss_team chỉ có quyền XEM danh sách
 * qua GET /auth/users, KHÔNG được tự tạo/sửa tài khoản người khác).
 */
export function isAdminRole(role: string | undefined | null): boolean {
  return role === 'admin';
}
