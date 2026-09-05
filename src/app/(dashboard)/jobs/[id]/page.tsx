import { getJobById, getJobApplicants, getJobSavers } from '@/app/actions/jobs';
import { getCurrentUser } from '@/app/actions/auth';
import { getMyApplications, getMySavedJobs } from '@/app/actions/me';
import { jobStatusChipClass, jobStatusLabel } from '@/lib/jobs/badges';
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
    // CHUYỂN 09/2026 (audit CSS): bỏ div "page-container" ngoài cùng —
    // class ảo, main.content (root layout.tsx) đã lo container rồi.
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">
            <Link href="/jobs">← Quay lại danh sách</Link>
          </span>
          <h1>{job.job_title}</h1>
          <p className="lede">{job.company_name || 'Công ty chưa xác định'}</p>
        </div>
        {/* Bỏ div "page-head-actions" bọc ngoài (class ảo) — .page-head
            vốn đã là flex space-between, nút chỉ cần là con trực tiếp. */}
        <Link href={`/jobs/${job.job_id}/edit`} className="btn btn-primary">
          Sửa Job
        </Link>
      </div>

      <div className="detail-grid">
        {/* Main Content */}
        <div className="detail-main">
          <section className="card">
            <h3>Thông tin chung</h3>
            {/* BUG FIX (audit CSS 09/2026): "detail-list" không tồn tại
                trong CSS nào — class thật cho khối dt/dd kiểu này là
                "kv" (public/css/06-detail-page.css, dùng chung với
                job_detail.html/company_detail.html gốc). */}
            <dl className="kv">
              <dt>Trạng thái</dt>
              <dd>
                <span className={`status-chip ${jobStatusChipClass(job.job_status)}`}>
                  {jobStatusLabel(job.job_status)}
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
                      // BUG FIX (audit CSS 09/2026): "badge-error" không
                      // tồn tại — class thật là "badge-danger", LUÔN đi
                      // kèm base "badge" (shape/padding riêng, xem
                      // public/css/12-activity-logs.css), không đứng 1
                      // mình như .status-chip/.badge-info.
                      <span className="badge badge-danger" style={{ marginLeft: '8px' }}>Đã hết hạn</span>
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
              này thực ra đã có sẵn — chỉ là chưa được đọc/render.
              Bỏ luôn div "job-description" bọc ngoài (class ảo, không
              cần wrapper — Flask gốc không có, để <p> nằm thẳng trong
              .card, dùng "empty-placeholder" (class thật) thay vì
              "muted" cho trạng thái trống, khớp job_detail.html gốc. */}
          <section className="card">
            <h3>Mô tả công việc</h3>
            {job.parsed_content?.job_description ? (
              <p style={{ whiteSpace: 'pre-wrap' }}>{job.parsed_content.job_description}</p>
            ) : (
              <p className="empty-placeholder">Chưa có mô tả chi tiết cho job này.</p>
            )}
          </section>

          {job.parsed_content?.requirements && (
            <section className="card">
              <h3>Yêu cầu ứng viên</h3>
              <p style={{ whiteSpace: 'pre-wrap' }}>{job.parsed_content.requirements}</p>
            </section>
          )}

          {job.parsed_content?.perks && (
            <section className="card">
              <h3>Quyền lợi</h3>
              <p style={{ whiteSpace: 'pre-wrap' }}>{job.parsed_content.perks}</p>
            </section>
          )}

          {job.parsed_content?.required_skills && job.parsed_content.required_skills.length > 0 && (
            <section className="card">
              <h3>Kỹ năng yêu cầu</h3>
              <div className="skill-row">
                {job.parsed_content.required_skills.map((skill) => (
                  <span key={skill} className="skill-tag">{skill}</span>
                ))}
              </div>
            </section>
          )}

          {/* Thêm 09/2026 (Phase 3.6) — chỉ staff mới thấy ai đã ứng tuyển/lưu job này */}
          {isStaff && <JobApplicantsPanel applicants={applicants} savers={savers} />}
        </div>

        {/* Sidebar — BUG FIX (audit CSS 09/2026): "detail-sidebar" không
            tồn tại, class thật là "detail-side" (public/css/06-detail-page.css,
            gồm cả position: sticky). */}
        <aside className="detail-side">
          <section className="card">
            <h4>Thông tin hệ thống</h4>
            <dl className="kv">
              <dt>ID</dt>
              <dd>{job.job_id}</dd>

              <dt>Ngày tạo</dt>
              <dd>{new Date(job.created_at).toLocaleDateString('vi-VN')}</dd>

              <dt>Cập nhật lần cuối</dt>
              <dd>{new Date(job.updated_at).toLocaleDateString('vi-VN')}</dd>

              {job.company_id && (
                <>
                  <dt>Công ty ID</dt>
                  <dd>
                    {/* Bỏ class "link" (ảo) — "kv dd a" đã tự tô màu
                        accent cho mọi link trong danh sách này rồi. */}
                    <Link href={`/companies/${job.company_id}`}>
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
              <div className="action-row">
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
    </>
  );
}
