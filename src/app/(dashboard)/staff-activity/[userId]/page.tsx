import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser, listUsers } from '@/app/actions/auth';
import { getStaffById } from '@/app/actions/staff';
import { isStaffRole, roleLabel } from '@/lib/auth/roles';
import { getJobs } from '@/app/actions/jobs';
import { getCompanies } from '@/app/actions/companies';
import { getContacts } from '@/app/actions/contacts';
import { ActivitySections } from '@/components/features/ActivitySections';

/**
 * Staff Activity — chi tiết hoạt động 1 nhân viên (BỔ SUNG 09/2026, rà
 * soát #3 — xem mục 6.10 plan_nextjs.md).
 * Khớp Flask: `blueprints/staff_activity.py::detail()`
 * (`templates/staff_activity_detail.html`), `@staff_required`.
 * Route: /staff-activity/[userId]
 *
 * CÙNG dữ liệu/logic với `/profile/activity` (profile.activity() bên
 * Flask): job/công ty/contact do `userId` tự thêm tay (created_by) +
 * contact đang được giao cho `userId` phụ trách (assigned_ss_user) —
 * chỉ khác ở chỗ lọc theo `userId` bất kỳ thay vì luôn là chính người
 * đang đăng nhập. Dùng chung component `ActivitySections`
 * (components/features/ActivitySections.tsx) để không lặp lại ~200
 * dòng markup giữa 2 trang.
 *
 * CHẶN xem hoạt động CHÍNH MÌNH qua khu vực quản trị này — khớp docstring
 * Flask gốc nguyên văn: "08/2026: xem hoạt động CHÍNH MÌNH qua khu vực
 * quản trị này đã bị chặn — dữ liệu giờ chỉ xem qua profile.activity
 * (trang cá nhân), tránh 2 nơi cùng hiển thị 1 dữ liệu". Chặn ở TẦNG
 * ROUTE (redirect ngay cả khi gõ thẳng URL), không chỉ ẩn link ở trang
 * danh sách `/staff-activity` (giống hệt cách Flask chặn — không chỉ
 * dựa vào template không render link).
 *
 * 404 (không phải trang trắng) nếu `userId` không tồn tại hoặc không
 * phải role ss_team/admin (vd học viên) — khớp `abort(404)` bên Flask
 * khi `staff_member is None`.
 */
export default async function StaffActivityDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const currentUser = await getCurrentUser();

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

  if (userId === currentUser?.ss_user_id) {
    redirect('/profile/activity');
  }

  const staffMember = await getStaffById(userId);
  if (!staffMember) {
    notFound();
  }

  const [allUsers, jobsResult, companiesResult, contactsCreated, contactsAssigned] =
    await Promise.all([
      listUsers(),
      getJobs({ created_by: userId, limit: 500, offset: 0 }),
      getCompanies({ created_by: userId, limit: 500, offset: 0 }),
      getContacts({ created_by: userId }),
      getContacts({ assigned_ss_user: userId }),
    ]);

  const staffById = new Map(allUsers.map((u) => [u.ss_user_id, u]));
  const jobsCreated = jobsResult.items;
  const companiesCreated = companiesResult.items;

  return (
    <>
      <Link className="back-link" href="/staff-activity">
        ← Hoạt động team SS
      </Link>

      <div className="page-head">
        <div>
          <span className="eyebrow">Career Hub / Quản trị / Hoạt động team SS</span>
          <h1>{staffMember.full_name}</h1>
          <p className="lede">
            {staffMember.email} · {roleLabel(staffMember.role)}
          </p>
        </div>
      </div>

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
        <dl className="kv">
          <dt>Ngày tạo tài khoản</dt>
          <dd>{new Date(staffMember.created_at).toLocaleDateString('vi-VN')}</dd>
        </dl>
      </div>

      <ActivitySections
        jobsCreated={jobsCreated}
        companiesCreated={companiesCreated}
        contactsCreated={contactsCreated}
        contactsAssigned={contactsAssigned}
        staffById={staffById}
      />
    </>
  );
}
