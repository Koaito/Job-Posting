import { getStaff } from '@/app/actions/staff';
import { getCurrentUser } from '@/app/actions/auth';
import { isAdminRole } from '@/lib/auth/roles';
import { StaffAccountsManager } from '@/components/features/StaffAccountsManager';

/**
 * Staff List Page (Nhân viên — ss_team/admin)
 * Corresponds to Flask: blueprints/staff.py (templates/staff/index.html)
 * Route: /staff
 *
 * Mới 09/2026 — trước đây thư mục staff/ hoàn toàn rỗng (404 thật, xem
 * CHANGES_09-2026.md). Phần XEM danh sách: mọi ss_team trở lên thấy
 * được (khớp GET /auth/users chỉ cần require_role("ss_team")). Phần
 * THAO TÁC (tạo tài khoản, đổi role, khoá/mở khoá): CHỈ admin — ẩn hẳn
 * UI cho ss_team thường thay vì hiện nút rồi để backend trả 403 (xem
 * StaffAccountsManager.tsx).
 */
export default async function StaffPage() {
  const [staff, currentUser] = await Promise.all([getStaff(), getCurrentUser()]);

  return (
    // BUG FIX (audit CSS 09/2026): bỏ "page-container" ảo — main.content
    // (root layout.tsx) đã lo container rồi.
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Career Hub / Quản lý</span>
          <h1>Nhân viên</h1>
          <p className="lede">Tổng {staff.length} tài khoản ss_team/admin</p>
        </div>
      </div>

      <StaffAccountsManager
        initialStaff={staff}
        currentUserId={currentUser?.ss_user_id || ''}
        isAdmin={isAdminRole(currentUser?.role)}
      />
    </>
  );
}
