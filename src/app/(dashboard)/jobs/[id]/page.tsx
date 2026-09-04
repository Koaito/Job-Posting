import { getJobById, getJobApplicants, getJobSavers } from '@/app/actions/jobs';
import { getCurrentUser } from '@/app/actions/auth';
import { getMyApplications, getMySavedJobs } from '@/app/actions/me';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import DeleteJobButton from '@/components/features/DeleteJobButton';
import JobApplyActions from '@/components/features/JobApplyActions';
import JobApplicantsPanel from '@/components/features/JobApplicantsPanel';
import { isStaffRole } from '@/lib/auth/roles';

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

  // Thêm 09/2026 (Phase 3.6) — nhánh học viên (nút Ứng tuyển/Lưu job) vs
  // staff (tab "Người đã ứng tuyển/Đã lưu") tách theo role. getCurrentUser()
  // dùng react.cache() nên gọi lại ở đây không tốn thêm network call nếu
  // layout.tsx đã gọi trong cùng request.
  const user = await getCurrentUser();
  const isStaff = isStaffRole(user?.role);

  const [myApplications, mySavedJobs] = isStaff
    ? [[], []]
    : await Promise.all([getMyApplications(), getMySavedJobs()]);
  const alreadyApplied = myApplications.some((a) => a.job_id === job.job_id);
  const alreadySaved = mySavedJobs.some((s) => s.job_id === job.job_id);

  const [applicants, savers] = isStaff
    ? await Promise.all([getJobApplicants(job.job_id), getJobSavers(job.job_id)])
    : [[], []];

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

          {/* Job Description
              BUG FIX (09/2026): trước đây luôn hard-code "Chưa có mô tả
              chi tiết" bất kể có dữ liệu hay không. GET /jobs/{job_id}
              (api/db/jobs.py::get_job_by_id) luôn trả kèm parsed_content
              (khác GET /jobs list cần include_content=true) nên field
              này thực ra đã có sẵn — chỉ là chưa được đọc/render. */}
          <section className="card">
            <h3>Mô tả công việc</h3>
            <div className="job-description">
              {job.parsed_content?.job_description ? (
                <p style={{ whiteSpace: 'pre-wrap' }}>{job.parsed_content.job_description}</p>
              ) : (
                <p className="muted">Chưa có mô tả chi tiết cho job này.</p>
              )}
            </div>
          </section>

          {job.parsed_content?.requirements && (
            <section className="card">
              <h3>Yêu cầu ứng viên</h3>
              <div className="job-description">
                <p style={{ whiteSpace: 'pre-wrap' }}>{job.parsed_content.requirements}</p>
              </div>
            </section>
          )}

          {job.parsed_content?.perks && (
            <section className="card">
              <h3>Quyền lợi</h3>
              <div className="job-description">
                <p style={{ whiteSpace: 'pre-wrap' }}>{job.parsed_content.perks}</p>
              </div>
            </section>
          )}

          {job.parsed_content?.required_skills && job.parsed_content.required_skills.length > 0 && (
            <section className="card">
              <h3>Kỹ năng yêu cầu</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {job.parsed_content.required_skills.map((skill) => (
                  <span key={skill} className="badge-info">{skill}</span>
                ))}
              </div>
            </section>
          )}

          {/* Thêm 09/2026 (Phase 3.6) — chỉ staff mới thấy ai đã ứng tuyển/lưu job này */}
          {isStaff && <JobApplicantsPanel applicants={applicants} savers={savers} />}
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

          {isStaff ? (
            <section className="card">
              <h4>Hành động</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Link href={`/jobs/${job.job_id}/edit`} className="btn btn-block">
                  ✏️ Sửa Job
                </Link>
                <DeleteJobButton jobId={job.job_id} jobTitle={job.job_title} />
              </div>
            </section>
          ) : (
            // Thêm 09/2026 (Phase 3.6) — học viên (role 'user') thấy nút
            // Ứng tuyển/Lưu job thay vì nút Sửa/Xoá dành cho staff.
            <section className="card">
              <h4>Hành động</h4>
              <JobApplyActions
                jobId={job.job_id}
                jobStatus={job.job_status}
                initiallyApplied={alreadyApplied}
                initiallySaved={alreadySaved}
              />
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
