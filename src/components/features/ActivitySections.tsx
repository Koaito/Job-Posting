import Link from 'next/link';
import type { Job } from '@/types/jobs';
import type { Company } from '@/types/companies';
import type { CompanyContactWithCompany } from '@/types/contacts';
import type { User } from '@/types/auth';
import { industryClass, jobStatusChipClass, jobStatusLabel } from '@/lib/jobs/badges';
import { partnershipPotentialClass } from '@/lib/companies/potential';

/**
 * 4 khối "job/công ty/contact đã tự thêm tay + contact đang phụ trách"
 * — TÁCH RA (rà soát #3, 09/2026, xem mục 6.10 plan_nextjs.md) từ JSX
 * gốc của `/profile/activity` để dùng chung với
 * `/staff-activity/[userId]` (staff_activity.detail() bên Flask dùng
 * CHÍNH XÁC cùng 1 nguồn dữ liệu/logic với profile.activity(), chỉ
 * khác ở chỗ lọc theo `ss_user_id` bất kỳ thay vì luôn là chính mình —
 * xem docstring `blueprints/staff_activity.py`). Không đổi bất kỳ
 * class CSS/markup nào so với bản gốc trong `/profile/activity`.
 *
 * staffById: dùng để hiện tên người tạo ở cột "Người tạo" của bảng
 * "Contact đang phụ trách" — optional vì `/profile/activity` (xem hoạt
 * động CHÍNH MÌNH) không thật sự cần tra cứu người khác thường xuyên,
 * nhưng vẫn truyền vào để nhất quán 2 nơi gọi.
 */
export interface ActivitySectionsProps {
  jobsCreated: Job[];
  companiesCreated: Company[];
  contactsCreated: CompanyContactWithCompany[];
  contactsAssigned: CompanyContactWithCompany[];
  staffById: Map<string, User>;
}

export function ActivitySections({
  jobsCreated,
  companiesCreated,
  contactsCreated,
  contactsAssigned,
  staffById,
}: ActivitySectionsProps) {
  return (
    <>
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
          <p>Chưa tự thêm job nào.</p>
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
          <p>Chưa tự thêm công ty nào.</p>
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
          <p>Chưa tự thêm contact nào.</p>
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
          <p>Chưa được giao phụ trách contact nào.</p>
        </div>
      )}
    </>
  );
}
