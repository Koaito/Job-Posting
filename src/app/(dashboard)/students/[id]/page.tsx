import { getStudentById } from '@/app/actions/students';
import Link from 'next/link';
import { notFound } from 'next/navigation';

/**
 * Student Detail Page — hồ sơ học viên + đơn ứng tuyển + job đã lưu.
 * Route: /students/[id]
 * Mới 09/2026 — dùng GET /auth/users/{id}/applications và
 * GET /auth/users/{id}/saved-jobs (ss_team trở lên), gộp với thông tin
 * cơ bản lọc từ GET /auth/users (không có endpoint GET 1 user đơn lẻ).
 */
export default async function StudentDetailPage({
  params,
}: {
  // BUG FIX: Next.js 15/16 — params là Promise, phải await trước khi đọc.
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getStudentById(id);

  if (!data) {
    notFound();
  }

  const { student, applications, savedJobs } = data;

  return (
    <div className="page-container">
      <div className="page-head">
        <div>
          <span className="eyebrow">
            <Link href="/students">← Học viên</Link>
          </span>
          <h1>{student.full_name}</h1>
          <p className="lede">{student.email}</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '22px' }}>
        <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div>
            <dt className="muted">SĐT</dt>
            <dd>{student.phone || '—'}</dd>
          </div>
          <div>
            <dt className="muted">Lớp (track)</dt>
            <dd>{student.track || '—'}</dd>
          </div>
          <div>
            <dt className="muted">Trạng thái</dt>
            <dd>
              {student.is_active ? (
                <span className="status-chip status-open">Hoạt động</span>
              ) : (
                <span className="status-chip status-closed">Đã khoá</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="muted">Đăng nhập gần nhất</dt>
            <dd>{student.last_login_at ? new Date(student.last_login_at).toLocaleString('vi-VN') : 'Chưa đăng nhập'}</dd>
          </div>
        </dl>
      </div>

      <h2>Đã ứng tuyển ({applications.length})</h2>
      {applications.length > 0 ? (
        <div className="contact-table-wrap" style={{ marginBottom: '22px' }}>
          <table className="contact-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Công ty</th>
                <th>Trạng thái job</th>
                <th>Ngày ứng tuyển</th>
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
                  <td className="muted">{new Date(a.applied_at).toLocaleDateString('vi-VN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state" style={{ marginBottom: '22px' }}>Chưa ứng tuyển job nào.</div>
      )}

      <h2>Đã lưu ({savedJobs.length})</h2>
      {savedJobs.length > 0 ? (
        <div className="contact-table-wrap">
          <table className="contact-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Công ty</th>
                <th>Trạng thái job</th>
                <th>Ngày lưu</th>
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
                  <td className="muted">{new Date(sj.created_at).toLocaleDateString('vi-VN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">Chưa lưu job nào.</div>
      )}
    </div>
  );
}
