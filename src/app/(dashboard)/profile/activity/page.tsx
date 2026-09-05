import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser, listUsers } from '@/app/actions/auth';
import { isStaffRole } from '@/lib/auth/roles';
import { getJobs } from '@/app/actions/jobs';
import { getCompanies } from '@/app/actions/companies';
import { getContacts } from '@/app/actions/contacts';
import { industryClass, jobStatusChipClass, jobStatusLabel } from '@/lib/jobs/badges';
import { partnershipPotentialClass } from '@/lib/companies/potential';
import ProfileSubnav from '@/components/features/ProfileSubnav';

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
 * với staff_activity.detail() (module /staff-activity, CHƯA làm ở
 * Next.js) nhưng chỉ xem được của bản thân — không nhận tham số
 * ss_user_id từ URL.
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

        <div className="activity-section-head">
          <h2>💼 Job đã tạo ({jobsCreated.length})</h2>
        </div>
        {jobsCreated.length > 0 ? (
          <div className="job-grid">
            {jobsCreated.map((job) => (
              <article key={job.job_id} className="ticket">
                <div className="ticket-stub">
                  <span className="ticket-code">JOB-{job.job_id.slice(0, 8).toUpperCase()}</span>
                  {job.matching_industry && (
                    <span className={`ticket-industry ${industryClass(job.matching_industry)}`}>
                      {job.matching_industry}
                    </span>
                  )}
                  {job.level_code && <span className="ticket-level">{job.level_code}</span>}
                </div>
                <div className="ticket-body">
                  <div className="ticket-top">
                    <h3>
                      <Link href={`/jobs/${job.job_id}`}>{job.job_title}</Link>
                    </h3>
                    <span className={`status-chip ${jobStatusChipClass(job.job_status)}`}>
                      {jobStatusLabel(job.job_status)}
                    </span>
                  </div>
                  <p className="ticket-company">
                    {job.company_name}
                    {job.province_name ? ` · ${job.province_name}` : ''}
                  </p>
                  <div className="ticket-meta">
                    <span>
                      📅 Hạn:{' '}
                      {job.deadline ? new Date(job.deadline).toLocaleDateString('vi-VN') : '—'}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>Bạn chưa tự thêm job nào.</p>
          </div>
        )}

        <div className="activity-section-head">
          <h2>🏢 Công ty đã tạo ({companiesCreated.length})</h2>
        </div>
        {companiesCreated.length > 0 ? (
          <div className="contact-table-wrap">
            <table className="contact-table">
              <thead>
                <tr>
                  <th>Công ty</th>
                  <th>Lĩnh vực</th>
                  <th>Tỉnh/thành</th>
                  <th className="col-potential">Tiềm năng</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {companiesCreated.map((c) => (
                  <tr key={c.company_id}>
                    <td>
                      <strong>
                        <Link href={`/companies/${c.company_id}`}>{c.company_name}</Link>
                      </strong>
                    </td>
                    <td className="muted">{c.industry || '—'}</td>
                    <td>{c.province_name || '—'}</td>
                    <td>
                      <span className={`fit-chip ${partnershipPotentialClass(c.partnership_potential)}`}>
                        {c.partnership_potential}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <Link className="btn btn-text" href={`/companies/${c.company_id}`}>
                        Xem →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>Bạn chưa tự thêm công ty nào.</p>
          </div>
        )}

        <div className="activity-section-head">
          <h2>☎ Contact đã tạo ({contactsCreated.length})</h2>
        </div>
        {contactsCreated.length > 0 ? (
          <div className="contact-table-wrap">
            <table className="contact-table">
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Công ty</th>
                  <th>Email</th>
                  <th>Trạng thái</th>
                  <th>Đang phụ trách</th>
                </tr>
              </thead>
              <tbody>
                {contactsCreated.map((c) => (
                  <tr key={c.contact_id}>
                    <td>
                      <strong>{c.contact_name}</strong>
                    </td>
                    <td>
                      <Link href={`/companies/${c.company_id}`}>{c.company_name}</Link>
                    </td>
                    <td className="muted">{c.work_email || '—'}</td>
                    <td className="muted">{c.contact_status}</td>
                    <td className="muted">
                      {(c.assigned_ss_user && staffById.get(c.assigned_ss_user)?.full_name) ||
                        '— Chưa gán —'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>Bạn chưa tự thêm contact nào.</p>
          </div>
        )}

        <div className="activity-section-head">
          <h2>🗂️ Contact đang phụ trách ({contactsAssigned.length})</h2>
        </div>
        {contactsAssigned.length > 0 ? (
          <div className="contact-table-wrap">
            <table className="contact-table">
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Công ty</th>
                  <th>Email</th>
                  <th>Người tạo</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {contactsAssigned.map((c) => (
                  <tr key={c.contact_id}>
                    <td>
                      <strong>{c.contact_name}</strong>
                    </td>
                    <td>
                      <Link href={`/companies/${c.company_id}`}>{c.company_name}</Link>
                    </td>
                    <td className="muted">{c.work_email || '—'}</td>
                    <td className="muted">
                      {(c.created_by && staffById.get(c.created_by)?.full_name) || '—'}
                    </td>
                    <td className="muted">{c.contact_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>Bạn chưa được giao phụ trách contact nào.</p>
          </div>
        )}
      </div>
    </div>
  );
}
