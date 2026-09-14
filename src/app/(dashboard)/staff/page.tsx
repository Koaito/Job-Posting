import { getStaff } from '@/app/actions/staff';
import { getCurrentUser } from '@/app/actions/auth';
import { getTranslations } from 'next-intl/server';
import { isAdminRole } from '@/lib/auth/roles';
import { StaffAccountsManager } from '@/components/features/StaffAccountsManager';
import { RequireRole } from '@/components/ui/guards/RequireRole';

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
 *
 * BUG FIX (audit kiến trúc 09/2026, #4): trang này TRƯỚC ĐÓ hoàn toàn
 * KHÔNG có check quyền nào ở tầng FE (khác 4 trang staff-only/admin-only
 * còn lại) — chỉ trông chờ backend trả 403 ở GET /auth/users, người
 * dùng thường (role='user') gõ thẳng URL /staff sẽ thấy trang lỗi thô
 * thay vì thông báo "không có quyền" tử tế. Bọc bằng <RequireRole> (dùng
 * chung với crawl/data-management/staff-activity) để vá đúng lỗ hổng
 * này.
 */
export default async function StaffPage() {
  const t = await getTranslations('staffPage');
  const [staff, currentUser] = await Promise.all([getStaff(), getCurrentUser()]);

  return (
    // BUG FIX (audit CSS 09/2026): bỏ "page-container" ảo — main.content
    // (root layout.tsx) đã lo container rồi.
    <RequireRole role="staff" deniedTitle={t('title')} deniedMessage={t('staffOnly')}>
      <div className="page-head">
        <div>
          <span className="eyebrow">{t('eyebrow')}</span>
          <h1>{t('title')}</h1>
          <p className="lede">{t('lede', { count: staff.length })}</p>
        </div>
      </div>

      <StaffAccountsManager
        initialStaff={staff}
        currentUserId={currentUser?.ss_user_id || ''}
        isAdmin={isAdminRole(currentUser?.role)}
      />
    </RequireRole>
  );
}
