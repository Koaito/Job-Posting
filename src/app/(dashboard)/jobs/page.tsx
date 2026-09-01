import { getJobs } from '@/app/actions/jobs';
import Link from 'next/link';

/**
 * Jobs List Page
 * Corresponds to Flask: templates/index.html (jobs list)
 * Route: /jobs
 */

interface SearchParams {
  search?: string;
  company_id?: string;
  status?: string;
  page?: string;
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const page = parseInt(searchParams.page || '1');
  const limit = 50;
  const offset = (page - 1) * limit;

  const { items: jobs, total } = await getJobs({
    search: searchParams.search,
    company_id: searchParams.company_id,
    status: searchParams.status,
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
            defaultValue={searchParams.search}
            style={{ flex: '1 1 300px', minWidth: '200px' }}
          />
          <select name="status" defaultValue={searchParams.status || ''}>
            <option value="">Tất cả trạng thái</option>
            <option value="OPEN">Đang tuyển</option>
            <option value="CLOSED">Đã đóng</option>
          </select>
          <button type="submit" className="btn">Lọc</button>
          {(searchParams.search || searchParams.status) && (
            <Link href="/jobs" className="btn">Xóa bộ lọc</Link>
          )}
        </form>
      </div>

      {/* Jobs Grid */}
      {jobs.length > 0 ? (
        <>
          <div className="job-grid">
            {jobs.map((job) => (
              <div key={job.id || `job-${Math.random()}`} className="job-card">
                <div className="job-card-header">
                  <h3 className="job-title">
                    <Link href={`/jobs/${job.id}`}>{job.job_title}</Link>
                  </h3>
                  <span className={`status-chip status-${job.job_status.toLowerCase()}`}>
                    {job.job_status === 'OPEN' ? 'Đang tuyển' : 'Đã đóng'}
                  </span>
                </div>

                <div className="job-card-body">
                  <p className="job-company">{job.company || '—'}</p>
                  
                  <div className="job-meta">
                    {job.matching_industry && (
                      <span key="industry" className="badge-info">{job.matching_industry}</span>
                    )}
                    {job.level && (
                      <span key="level" className="badge-info">{job.level}</span>
                    )}
                    {job.location && (
                      <span key="location" className="badge-info">{job.location}</span>
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
                  <Link href={`/jobs/${job.id}`} className="btn btn-sm">
                    Xem chi tiết
                  </Link>
                  <Link href={`/jobs/${job.id}/edit`} className="btn btn-sm btn-secondary">
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
                  href={`/jobs?page=${page - 1}${searchParams.search ? `&search=${searchParams.search}` : ''}${searchParams.status ? `&status=${searchParams.status}` : ''}`}
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
                  href={`/jobs?page=${page + 1}${searchParams.search ? `&search=${searchParams.search}` : ''}${searchParams.status ? `&status=${searchParams.status}` : ''}`}
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
          {(searchParams.search || searchParams.status) ? (
            <Link href="/jobs" className="btn">Xóa bộ lọc</Link>
          ) : (
            <Link href="/jobs/new" className="btn btn-primary">Thêm Job Đầu Tiên</Link>
          )}
        </div>
      )}
    </div>
  );
}
