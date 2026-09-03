import { getStaff } from '@/app/actions/staff';
import { getCurrentUser } from '@/app/actions/auth';
import { isAdminRole } from '@/lib/auth/roles';
import StaffAccountsManager from '@/components/features/StaffAccountsManager';

/**
 * Staff Accounts List Page
 * Corresponds to Flask: templates/staff_accounts.html
 * Route: /staff
 *
 * BUG FIX (audit 09/2026 #13): trước đây không tồn tại (link Sidebar
 * 404). (dashboard)/layout.tsx đã bắt buộc đăng nhập ở tầng cha — trang
 * này KHÔNG tự chặn lại role (ai đăng nhập cũng gọi getStaff() được),
 * đúng với backend: GET /auth/users chỉ cần role 'ss_team' trở lên, còn
 * 3 hành động ghi (thêm/đổi role/khoá) mới cần đúng admin — chặn ở tầng
 * UI trong StaffAccountsManager (prop isAdmin) khớp đúng ranh giới đó.
 */
export default async function StaffPage() {
  const [staff, currentUser] = await Promise.all([getStaff(), getCurrentUser()]);
  const isAdmin = isAdminRole(currentUser?.role);

  return (
    <div className="page-container">
      <div className="page-head">
        <div>
          <span className="eyebrow">Career Hub / Quản lý</span>
          <h1>Nhân viên</h1>
          <p className="lede">Tổng {staff.length} tài khoản team SS/admin</p>
        </div>
      </div>

      {staff.length > 0 || isAdmin ? (
        <StaffAccountsManager
          staff={staff}
          currentUserId={currentUser?.ss_user_id || ''}
          isAdmin={isAdmin}
        />
      ) : (
        <div className="empty-state">
          <p>Không tải được danh sách nhân viên.</p>
        </div>
      )}
    </div>
  );
}
