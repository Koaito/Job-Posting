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
