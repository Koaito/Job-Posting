import type { ReactNode } from 'react';
import { getCurrentUser } from '@/app/actions/auth';
import { isAdminRole, isStaffRole } from '@/lib/auth/roles';

export type RequiredRole = 'staff' | 'admin';

interface RequireRoleProps {
  /** 'staff' = ss_team hoặc admin được xem trang; 'admin' = chỉ admin. */
  role: RequiredRole;
  /** Tiêu đề hiển thị khi bị chặn quyền (page.tsx tự truyền, ví dụ t('title')). */
  deniedTitle: string;
  /** Nội dung thông báo khi bị chặn quyền (page.tsx tự truyền, ví dụ t('staffOnly')). */
  deniedMessage: string;
  children: ReactNode;
}

/**
 * Guard dùng chung cho trang staff-only/admin-only (rà soát kiến trúc
 * 09/2026, mục #4).
 *
 * TRƯỚC đợt này: mỗi trang (crawl, data-management, staff-activity,
 * staff-activity/[userId]) tự viết lại y hệt logic getCurrentUser() +
 * isStaffRole()/isAdminRole() + tự vẽ UI "không có quyền" riêng lẻ —
 * middleware.ts (tầng ngoài cùng) chỉ chặn được request CHƯA đăng nhập
 * (401), hoàn toàn không biết gì về role (403), nên việc chặn theo role
 * phải nằm ở từng page.tsx, rất dễ quên khi thêm trang mới. Thực tế:
 * staff/page.tsx (trang /staff) TRƯỚC đợt này HOÀN TOÀN KHÔNG có check
 * quyền nào ở tầng FE — chỉ trông chờ backend trả 403 ở GET /auth/users,
 * không có UI "không có quyền" tử tế như 4 trang kia (đúng lỗ hổng mà
 * mục #4 nêu ra).
 *
 * getCurrentUser() dùng React cache() (xem actions/auth.ts) nên page.tsx
 * gọi getCurrentUser() riêng thêm 1 lần (để lấy currentUser.ss_user_id
 * truyền xuống component con, ví dụ StaffAccountsManager) VẪN CHỈ tốn
 * đúng 1 lần gọi network trong cùng 1 request — gọi lại ở đây không tốn
 * thêm gì.
 *
 * deniedTitle/deniedMessage do page.tsx tự truyền vào (thay vì component
 * này tự có 1 namespace i18n riêng) để giữ ĐÚNG NGUYÊN VĂN text/namespace
 * đã dùng ở từng trang trước đây (crawlPage dùng staffOnlyTitle/
 * staffOnlyMessage khác các trang còn lại dùng chung title/staffOnly) —
 * không đổi hành vi hiển thị, chỉ gom phần LOGIC kiểm tra quyền.
 */
export async function RequireRole({ role, deniedTitle, deniedMessage, children }: RequireRoleProps) {
  const currentUser = await getCurrentUser();
  const allowed = role === 'admin' ? isAdminRole(currentUser?.role) : isStaffRole(currentUser?.role);

  if (!allowed) {
    return (
      <>
        <div className="page-head">
          <h1>{deniedTitle}</h1>
        </div>
        <div className="empty-state">
          <p>{deniedMessage}</p>
        </div>
      </>
    );
  }

  return <>{children}</>;
}
