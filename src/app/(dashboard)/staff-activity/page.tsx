import { getStaff } from '@/app/actions/staff';
import { getCurrentUser } from '@/app/actions/auth';
import { isStaffRole } from '@/lib/auth/roles';
import { StaffActivityList } from '@/components/features/StaffActivityList';

/**
 * Staff Activity — danh sách nhân viên (Nhân viên/BỔ SUNG 09/2026, rà
 * soát #3 — xem mục 6.10 plan_nextjs.md).
 * Khớp Flask: `blueprints/staff_activity.py::index()`
 * (`templates/staff_activity.html`), `@staff_required` (ss_team/admin).
 * Route: /staff-activity
 *
 * Chọn 1 thành viên → xem job/công ty/contact họ tự thêm tay + contact
 * đang được giao phụ trách (khác `/activity` — 6.4, xem TOÀN BỘ audit
 * log mọi người trộn chung; đây là góc nhìn "theo từng nhân viên", để
 * đánh giá năng suất/khối lượng việc của từng SS).
 *
 * Xem hoạt động CHÍNH MÌNH qua khu vực quản trị này bị chặn (giống
 * Flask gốc) — dòng của chính người đang xem chỉ có link "Xem tại
 * Trang cá nhân →" trỏ sang `/profile/activity`, không có link
 * `/staff-activity/[userId]` (chặn thêm 1 lớp nữa ở tầng route
 * `[userId]/page.tsx`, xem docstring ở đó).
 *
 * getStaff() (actions/staff.ts) đã có sẵn từ Phase 6.2 (lọc
 * role !== 'user' từ GET /auth/users) — tái dùng thẳng, không cần
 * Server Action mới.
 */
export default async function StaffActivityPage() {
  const [staff, currentUser] = await Promise.all([getStaff(), getCurrentUser()]);

  if (!isStaffRole(currentUser?.role)) {
    return (
      <>
        <div className="page-head">
          <h1>Hoạt động team SS</h1>
        </div>
        <div className="empty-state">
          <p>Trang này chỉ dành cho nhân viên (ss_team/admin).</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Career Hub / Quản trị</span>
          <h1>Hoạt động team SS</h1>
          <p className="lede">
            Chọn 1 thành viên để xem job/công ty/contact họ đã tự thêm tay, và contact đang
            được giao cho họ phụ trách — dùng để nắm ai đang làm việc gì. Xem hoạt động của
            chính bạn? Vào{' '}
            <a href="/profile/activity">Trang cá nhân</a>.
          </p>
        </div>
      </div>

      {staff.length > 0 ? (
        <StaffActivityList staff={staff} currentUserId={currentUser?.ss_user_id || ''} />
      ) : (
        <div className="empty-state">
          <p>Chưa có thành viên team SS nào.</p>
        </div>
      )}
    </>
  );
}
