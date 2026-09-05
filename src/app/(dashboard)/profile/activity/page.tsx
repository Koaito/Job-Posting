import { redirect } from 'next/navigation';
import { getCurrentUser, listUsers } from '@/app/actions/auth';
import { isStaffRole } from '@/lib/auth/roles';
import { getJobs } from '@/app/actions/jobs';
import { getCompanies } from '@/app/actions/companies';
import { getContacts } from '@/app/actions/contacts';
import ProfileSubnav from '@/components/features/ProfileSubnav';
import { ActivitySections } from '@/components/features/ActivitySections';

/**
 * Trang cá nhân — Hoạt động. Khớp profile.activity() bên Flask gốc
 * (blueprints/profile.py) + templates/profile_activity.html.
 *
 * Module còn thiếu hoàn toàn ở Next.js (mục "Module còn thiếu hoàn
 * toàn" trong plan_nextjs.md) — Flask đã có, Next.js chưa. Thêm 09/2026.
 *
 * @staff_required bên Flask (không phải @login_required) — chỉ
 * ss_team/admin có ý nghĩa (học viên không tạo job/công ty/contact,
 * mục "Hoạt động" cũng không hiện trong sub-nav với họ). Chặn ở tầng
 * route giống các trang staff-only khác (/activity, /contacts) — dùng
 * isStaffRole(), KHÔNG dùng field "is_staff" (field ảo, backend không
 * bao giờ trả — xem lib/auth/roles.ts).
 *
 * Hiển thị 4 nhóm dữ liệu CHÍNH NGƯỜI ĐANG ĐĂNG NHẬP: job/công ty/
 * contact tự thêm tay (created_by = chính mình) + contact đang được
 * giao phụ trách (assigned_ss_user = chính mình). Cùng dữ liệu/logic
 * với staff_activity.detail() (module `/staff-activity`, đã làm ở
 * Next.js — rà soát #3 09/2026, xem mục 6.10 plan_nextjs.md) nhưng chỉ
 * xem được của bản thân — không nhận tham số ss_user_id từ URL. 4 khối
 * JSX dùng chung với `/staff-activity/[userId]` qua component
 * `ActivitySections` (components/features/ActivitySections.tsx) — tách
 * ra khỏi file này khi dựng `/staff-activity` để tránh trùng lặp gần
 * 200 dòng markup giữa 2 trang cùng 1 nguồn dữ liệu.
 *
 * Khác Flask gốc (ThreadPoolExecutor song song hoá 4 lệnh gọi): ở đây
 * dùng Promise.all — Next.js/Node đã tự xử lý I/O bất đồng bộ không
 * chặn luồng, không cần thread pool riêng để đạt hiệu quả tương đương
 * (4 request bắn đồng thời, tổng thời gian ≈ round-trip chậm nhất).
 *
 * Contact hiển thị CHỈ ĐỌC (không có form đổi người phụ trách ngay tại
 * đây như _contact_assign_cell.html bên Flask) — nhất quán với cách
 * /contacts (trang danh sách liên hệ gộp mọi công ty) đã làm: link
 * sang trang chi tiết công ty (CompanyContactsManager) để thao tác,
 * giữ đúng phạm vi "trang xem hoạt động", không tự thêm form mới ở
 * đây.
 *
 * getContacts() không hỗ trợ limit/offset thật (BUG FIX 09/2026 đã ghi
 * ở contacts/page.tsx) — luôn trả toàn bộ mảng khớp filter, không cần
 * phân trang thêm ở đây vì đã tự filter theo unique
 * created_by/assigned_ss_user (chính mình), số lượng nhỏ.
 */
export default async function ProfileActivityPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  if (!isStaffRole(user.role)) {
    return (
      <>
        <div className="page-head">
          <h1>Hoạt động</h1>
        </div>
        <div className="empty-state">
          <p>Trang này chỉ dành cho nhân viên (ss_team/admin).</p>
        </div>
      </>
    );
  }

  const ssUserId = user.ss_user_id;

  const [allUsers, jobsResult, companiesResult, contactsCreated, contactsAssigned] =
    await Promise.all([
      listUsers(),
      getJobs({ created_by: ssUserId, limit: 500, offset: 0 }),
      getCompanies({ created_by: ssUserId, limit: 500, offset: 0 }),
      getContacts({ created_by: ssUserId }),
      getContacts({ assigned_ss_user: ssUserId }),
    ]);

  const staffById = new Map(allUsers.map((u) => [u.ss_user_id, u]));
  const jobsCreated = jobsResult.items;
  const companiesCreated = companiesResult.items;

  return (
    <div className="auth-shell">
      <div className="auth-card profile-card">
        <h1>Trang cá nhân</h1>
        <p className="lede">
          Job/công ty/contact bạn đã tự thêm tay, và contact đang được giao cho bạn phụ
          trách.
        </p>

        <ProfileSubnav active="activity" isStudent={false} isStaff />

        <div className="card student-summary-card">
          <dl className="kv">
            <dt>Job đã tạo</dt>
            <dd>{jobsCreated.length}</dd>
            <dt>Công ty đã tạo</dt>
            <dd>{companiesCreated.length}</dd>
            <dt>Contact đã tạo</dt>
            <dd>{contactsCreated.length}</dd>
            <dt>Contact đang phụ trách</dt>
            <dd>{contactsAssigned.length}</dd>
          </dl>
        </div>

        <ActivitySections
          jobsCreated={jobsCreated}
          companiesCreated={companiesCreated}
          contactsCreated={contactsCreated}
          contactsAssigned={contactsAssigned}
          staffById={staffById}
        />
      </div>
    </div>
  );
}
