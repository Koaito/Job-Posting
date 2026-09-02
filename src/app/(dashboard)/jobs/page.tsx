import { getJobs } from '@/app/actions/jobs';
import Link from 'next/link';

/**
 * Jobs List Page
 * Corresponds to Flask: templates/index.html (jobs list)
 * Route: /jobs
 */

interface SearchParams {
  search?: string;
  status?: string;
  page?: string;
}

export default async function JobsPage({
  searchParams,
}: {
  // BUG FIX: Next.js 15/16 — searchParams là Promise, phải await trước
  // khi đọc property, nếu không mọi property đều là undefined và
  // filter/phân trang bị bỏ qua trong im lặng.
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const page = parseInt(resolvedSearchParams.page || '1');
  const limit = 50;
  const offset = (page - 1) * limit;

  // BUG FIX (audit 09/2026): ô "Tìm theo tên job" gửi field "search"
  // (tên form input, giữ nguyên cho UI) nhưng backend GET /jobs chờ
  // param "keyword" — map lại đúng tên khi gọi getJobs(), nếu không lọc
  // bị bỏ qua trong im lặng dù form không báo lỗi gì.
  const { items: jobs, total } = await getJobs({
    keyword: resolvedSearchParams.search,
    status: resolvedSearchParams.status,
    limit,
    offset,
  });

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="page-container">
      <div className="page-head">
        <div>
          <span className="eyebrow">Career Hub / Quản lý</span>
          <h1>Danh sách Job</h1>
          <p className="lede">
            Tổng {total} job trong database
          </p>
        </div>
        <div className="page-head-actions">
          <Link href="/jobs/new" className="btn btn-primary">
            + Thêm Job Mới
          </Link>
        </div>
      </div>

      {/* Filters - TODO: Implement later */}
      <div className="filter-bar" style={{ marginBottom: '22px' }}>
        <form method="get" action="/jobs" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input
            type="search"
            name="search"
            placeholder="Tìm theo tên job..."
            defaultValue={resolvedSearchParams.search}
            style={{ flex: '1 1 300px', minWidth: '200px' }}
          />
          <select name="status" defaultValue={resolvedSearchParams.status || ''}>
            <option value="">Tất cả trạng thái</option>
            <option value="OPEN">Đang tuyển</option>
            <option value="CLOSED">Đã đóng</option>
          </select>
          <button type="submit" className="btn">Lọc</button>
          {(resolvedSearchParams.search || resolvedSearchParams.status) && (
            <Link href="/jobs" className="btn">Xóa bộ lọc</Link>
          )}
        </form>
      </div>

      {/* Jobs Grid */}
      {jobs.length > 0 ? (
        <>
          <div className="job-grid">
            {jobs.map((job) => (
              <div key={job.job_id} className="job-card">
                <div className="job-card-header">
                  <h3 className="job-title">
                    <Link href={`/jobs/${job.job_id}`}>{job.job_title}</Link>
                  </h3>
                  <span className={`status-chip status-${job.job_status.toLowerCase()}`}>
                    {job.job_status === 'OPEN' ? 'Đang tuyển' : 'Đã đóng'}
                  </span>
                </div>

                <div className="job-card-body">
                  <p className="job-company">{job.company_name || '—'}</p>
                  
                  <div className="job-meta">
                    {job.matching_industry && (
                      <span key="industry" className="badge-info">{job.matching_industry}</span>
                    )}
                    {job.level_code && (
                      <span key="level" className="badge-info">{job.level_code}</span>
                    )}
                    {job.province_name && (
                      <span key="location" className="badge-info">{job.province_name}</span>
                    )}
                  </div>

                  {(job.salary_min || job.salary_max) && (
                    <p className="job-salary">
                      💰 {job.salary_min?.toLocaleString() || '—'} - {job.salary_max?.toLocaleString() || '—'} {job.currency || 'VNĐ'}
                    </p>
                  )}

                  {job.deadline && (
                    <p className="job-deadline">
                      📅 Hạn nộp: {new Date(job.deadline).toLocaleDateString('vi-VN')}
                    </p>
                  )}
                </div>

                <div className="job-card-footer">
                  <Link href={`/jobs/${job.job_id}`} className="btn btn-sm">
                    Xem chi tiết
                  </Link>
                  <Link href={`/jobs/${job.job_id}/edit`} className="btn btn-sm btn-secondary">
                    Sửa
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              {page > 1 && (
                <Link 
                  href={`/jobs?page=${page - 1}${resolvedSearchParams.search ? `&search=${resolvedSearchParams.search}` : ''}${resolvedSearchParams.status ? `&status=${resolvedSearchParams.status}` : ''}`}
                  className="page-btn"
                >
                  ← Trang trước
                </Link>
              )}
              
              <span className="page-status">
                Trang {page} / {totalPages}
              </span>

              {page < totalPages && (
                <Link 
                  href={`/jobs?page=${page + 1}${resolvedSearchParams.search ? `&search=${resolvedSearchParams.search}` : ''}${resolvedSearchParams.status ? `&status=${resolvedSearchParams.status}` : ''}`}
                  className="page-btn"
                >
                  Trang sau →
                </Link>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <p>Không tìm thấy job nào.</p>
          {(resolvedSearchParams.search || resolvedSearchParams.status) ? (
            <Link href="/jobs" className="btn">Xóa bộ lọc</Link>
          ) : (
            <Link href="/jobs/new" className="btn btn-primary">Thêm Job Đầu Tiên</Link>
          )}
        </div>
      )}
    </div>
  );
}
