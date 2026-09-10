import { getStudentById } from '@/app/actions/students';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, getLocale } from 'next-intl/server';
import CvDownloadButton from '@/components/features/CvDownloadButton';
import { toIntlLocale } from '@/i18n/config';

/**
 * Student Detail Page — hồ sơ học viên + đơn ứng tuyển + job đã lưu.
 * Route: /students/[id]
 * Mới 09/2026 — dùng GET /auth/users/{id}/applications và
 * GET /auth/users/{id}/saved-jobs (ss_team trở lên), gộp với thông tin
 * cơ bản lọc từ GET /auth/users (không có endpoint GET 1 user đơn lẻ).
 *
 * THÊM 09/2026 (rà soát #3, chat139) — cột "CV" ở bảng "Đã ứng tuyển":
 * Flask (/students/cv/<application_id>) cho staff tải CV ngay tại đây,
 * Next.js trước đợt này chỉ gọi getCvSignedUrl() ở JobApplicantsPanel
 * (trang chi tiết job) — cùng action, cùng quyền, chỉ thiếu gắn vào
 * đúng chỗ này.
 */
export default async function StudentDetailPage({
  params,
}: {
  // BUG FIX: Next.js 15/16 — params là Promise, phải await trước khi đọc.
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations('studentDetailPage');
  const dateLocale = toIntlLocale(await getLocale());
  const { id } = await params;
  const data = await getStudentById(id);

  if (!data) {
    notFound();
  }

  const { student, applications, savedJobs } = data;

  return (
    // BUG FIX (audit CSS 09/2026): bỏ div "page-container" bọc ngoài —
    // class ảo, main.content (root layout.tsx) đã lo container rồi.
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">
            <Link href="/students">{t('backToList')}</Link>
          </span>
          <h1>{student.full_name}</h1>
          <p className="lede">{student.email}</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '22px' }}>
        <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div>
            <dt className="muted">{t('phone')}</dt>
            <dd>{student.phone || '—'}</dd>
          </div>
          <div>
            <dt className="muted">{t('track')}</dt>
            <dd>{student.track || '—'}</dd>
          </div>
          <div>
            <dt className="muted">{t('status')}</dt>
            {/* BUG FIX (audit CSS 09/2026): cùng bug với students/page.tsx
                — bỏ chip "status-chip status-open/status-closed" mượn
                sai domain job, hiện chữ thường theo đúng cách Flask gốc
                hiện trạng thái tài khoản (staff_accounts.html). */}
            <dd>{student.is_active ? t('statusActive') : t('statusLocked')}</dd>
          </div>
          <div>
            <dt className="muted">{t('lastLogin')}</dt>
            {/* Polish (09/2026): dateLocale theo locale hiện tại thay vì
                hard-code 'vi-VN'. */}
            <dd>{student.last_login_at ? new Date(student.last_login_at).toLocaleString(dateLocale) : t('neverLoggedIn')}</dd>
          </div>
        </dl>
      </div>

      <h2>{t('appliedJobs', { count: applications.length })}</h2>
      {applications.length > 0 ? (
        <div className="contact-table-wrap" style={{ marginBottom: '22px' }}>
          <table className="contact-table">
            <thead>
              <tr>
                <th>{t('colJob')}</th>
                <th>{t('colCompany')}</th>
                <th>{t('colJobStatus')}</th>
                <th>{t('colAppliedAt')}</th>
                <th>{t('colCv')}</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((a) => (
                <tr key={a.application_id}>
                  <td>
                    <Link href={`/jobs/${a.job_id}`}>{a.job_title}</Link>
                  </td>
                  <td className="muted">{a.company_name}</td>
                  <td className="muted">{a.job_status || '—'}</td>
                  <td className="muted">{new Date(a.applied_at).toLocaleDateString(dateLocale)}</td>
                  <td>{a.cv_url ? <CvDownloadButton applicationId={a.application_id} /> : <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state" style={{ marginBottom: '22px' }}>{t('noApplications')}</div>
      )}

      <h2>{t('savedJobs', { count: savedJobs.length })}</h2>
      {savedJobs.length > 0 ? (
        <div className="contact-table-wrap">
          <table className="contact-table">
            <thead>
              <tr>
                <th>{t('colJob')}</th>
                <th>{t('colCompany')}</th>
                <th>{t('colJobStatus')}</th>
                <th>{t('colSavedAt')}</th>
              </tr>
            </thead>
            <tbody>
              {savedJobs.map((sj) => (
                <tr key={sj.saved_job_id}>
                  <td>
                    <Link href={`/jobs/${sj.job_id}`}>{sj.job_title}</Link>
                  </td>
                  <td className="muted">{sj.company_name}</td>
                  <td className="muted">{sj.job_status || '—'}</td>
                  <td className="muted">{new Date(sj.created_at).toLocaleDateString(dateLocale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">{t('noSavedJobs')}</div>
      )}
    </>
  );
}
