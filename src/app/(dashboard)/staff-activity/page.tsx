import { getStaff } from '@/app/actions/staff';
import { getCurrentUser } from '@/app/actions/auth';
import { getTranslations } from 'next-intl/server';
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
  const t = await getTranslations('staffActivityPage');
  const [staff, currentUser] = await Promise.all([getStaff(), getCurrentUser()]);

  if (!isStaffRole(currentUser?.role)) {
    return (
      <>
        <div className="page-head">
          <h1>{t('title')}</h1>
        </div>
        <div className="empty-state">
          <p>{t('staffOnly')}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">{t('eyebrow')}</span>
          <h1>{t('title')}</h1>
          <p className="lede">
            {t('ledeBeforeLink')}{' '}
            <a href="/profile/activity">{t('ledeLink')}</a>.
          </p>
        </div>
      </div>

      {staff.length > 0 ? (
        <StaffActivityList staff={staff} currentUserId={currentUser?.ss_user_id || ''} />
      ) : (
        <div className="empty-state">
          <p>{t('empty')}</p>
        </div>
      )}
    </>
  );
}
