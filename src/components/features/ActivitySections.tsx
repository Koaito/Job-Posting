import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { Job } from '@/types/jobs';
import type { Company } from '@/types/companies';
import type { CompanyContactWithCompany } from '@/types/contacts';
import type { User } from '@/types/auth';
import { industryClass, jobStatusChipClass, jobStatusLabel } from '@/lib/jobs/badges';
import { partnershipPotentialClass, partnershipPotentialLabel } from '@/lib/companies/potential';

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

export async function ActivitySections({
  jobsCreated,
  companiesCreated,
  contactsCreated,
  contactsAssigned,
  staffById,
}: ActivitySectionsProps) {
  const t = await getTranslations('activitySections');
  const tPotential = await getTranslations('partnershipPotential');
  return (
    <>
      <div className="activity-section-head">
        <h2>💼 {t('jobsCreated', { count: jobsCreated.length })}</h2>
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
                    📅 {t('deadline')}:{' '}
                    {/* CỐ Ý CHƯA dịch: toLocaleDateString('vi-VN') — thuộc
                        phạm vi Polish, không xử lý ở đợt Language này. */}
                    {job.deadline ? new Date(job.deadline).toLocaleDateString('vi-VN') : '—'}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p>{t('noJobsCreated')}</p>
        </div>
      )}

      <div className="activity-section-head">
        <h2>🏢 {t('companiesCreated', { count: companiesCreated.length })}</h2>
      </div>
      {companiesCreated.length > 0 ? (
        <div className="contact-table-wrap">
          <table className="contact-table">
            <thead>
              <tr>
                <th>{t('colCompany')}</th>
                <th>{t('colIndustry')}</th>
                <th>{t('colProvince')}</th>
                <th className="col-potential">{t('colPotential')}</th>
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
                      {partnershipPotentialLabel(c.partnership_potential, tPotential)}
                    </span>
                  </td>
                  <td className="actions-cell">
                    <Link className="btn btn-text" href={`/companies/${c.company_id}`}>
                      {t('view')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <p>{t('noCompaniesCreated')}</p>
        </div>
      )}

      <div className="activity-section-head">
        <h2>☎ {t('contactsCreated', { count: contactsCreated.length })}</h2>
      </div>
      {contactsCreated.length > 0 ? (
        <div className="contact-table-wrap">
          <table className="contact-table">
            <thead>
              <tr>
                <th>{t('colName')}</th>
                <th>{t('colCompany')}</th>
                <th>{t('colEmail')}</th>
                <th>{t('colStatus')}</th>
                <th>{t('colAssignedTo')}</th>
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
                      t('unassigned')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <p>{t('noContactsCreated')}</p>
        </div>
      )}

      <div className="activity-section-head">
        <h2>🗂️ {t('contactsAssigned', { count: contactsAssigned.length })}</h2>
      </div>
      {contactsAssigned.length > 0 ? (
        <div className="contact-table-wrap">
          <table className="contact-table">
            <thead>
              <tr>
                <th>{t('colName')}</th>
                <th>{t('colCompany')}</th>
                <th>{t('colEmail')}</th>
                <th>{t('colCreatedBy')}</th>
                <th>{t('colStatus')}</th>
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
          <p>{t('noContactsAssigned')}</p>
        </div>
      )}
    </>
  );
}
