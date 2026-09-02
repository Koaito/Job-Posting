import { getJobById } from '@/app/actions/jobs';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import DeleteJobButton from '@/components/features/DeleteJobButton';

/**
 * Job Detail Page
 * Corresponds to Flask: templates/job_detail.html
 * Route: /jobs/[id]
 */

export default async function JobDetailPage({
  params,
}: {
  // BUG FIX: Next.js 15/16 — params là Promise, phải await trước khi
  // đọc params.id, nếu không getJobById(undefined) sẽ luôn notFound().
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await getJobById(id);

  if (!job) {
    notFound();
  }

  return (
    <div className="page-container">
      <div className="page-head">
        <div>
          <span className="eyebrow">
            <Link href="/jobs">← Quay lại danh sách</Link>
          </span>
          <h1>{job.job_title}</h1>
          <p className="lede">{job.company_name || 'Công ty chưa xác định'}</p>
        </div>
        <div className="page-head-actions">
          <Link href={`/jobs/${job.job_id}/edit`} className="btn btn-primary">
            Sửa Job
          </Link>
        </div>
      </div>

      <div className="detail-grid">
        {/* Main Content */}
        <div className="detail-main">
          <section className="card">
            <h3>Thông tin chung</h3>
            <dl className="detail-list">
              <dt>Trạng thái</dt>
              <dd>
                <span className={`status-chip status-${job.job_status.toLowerCase()}`}>
                  {job.job_status === 'OPEN' ? 'Đang tuyển' : 'Đã đóng'}
                </span>
              </dd>

              {job.matching_industry && (
                <>
                  <dt>Ngành</dt>
                  <dd>{job.matching_industry}</dd>
                </>
              )}

              {job.level_code && (
                <>
                  <dt>Level</dt>
                  <dd>{job.level_code}</dd>
                </>
              )}

              {job.province_name && (
                <>
                  <dt>Địa điểm</dt>
                  <dd>{job.province_name}</dd>
                </>
              )}

              {(job.salary_min || job.salary_max) && (
                <>
                  <dt>Mức lương</dt>
                  <dd>
                    {job.salary_min?.toLocaleString() || '—'} - {job.salary_max?.toLocaleString() || '—'} {job.currency || 'VNĐ'}
                    {job.salary_type && <span className="muted"> ({job.salary_type})</span>}
                  </dd>
                </>
              )}

              {job.deadline && (
                <>
                  <dt>Hạn nộp</dt>
                  <dd>
                    {new Date(job.deadline).toLocaleDateString('vi-VN')}
                    {new Date(job.deadline) < new Date() && (
                      <span className="badge-error" style={{ marginLeft: '8px' }}>Đã hết hạn</span>
                    )}
                  </dd>
                </>
              )}
            </dl>
          </section>

          {/* Job Description - TODO: Parse from parsed_content JSONB */}
          <section className="card">
            <h3>Mô tả công việc</h3>
            <div className="job-description">
              <p className="muted">Chưa có mô tả chi tiết. Dữ liệu nằm trong parsed_content (JSONB).</p>
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="detail-sidebar">
          <section className="card">
            <h4>Thông tin hệ thống</h4>
            <dl className="detail-list">
              <dt>ID</dt>
              <dd className="font-mono">{job.job_id}</dd>

              <dt>Ngày tạo</dt>
              <dd>{new Date(job.created_at).toLocaleDateString('vi-VN')}</dd>

              <dt>Cập nhật lần cuối</dt>
              <dd>{new Date(job.updated_at).toLocaleDateString('vi-VN')}</dd>

              {job.company_id && (
                <>
                  <dt>Công ty ID</dt>
                  <dd>
                    <Link href={`/companies/${job.company_id}`} className="link">
                      {job.company_id.slice(0, 8)}...
                    </Link>
                  </dd>
                </>
              )}
            </dl>
          </section>

          <section className="card">
            <h4>Hành động</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link href={`/jobs/${job.job_id}/edit`} className="btn btn-block">
                ✏️ Sửa Job
              </Link>
              <DeleteJobButton jobId={job.job_id} jobTitle={job.job_title} />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
