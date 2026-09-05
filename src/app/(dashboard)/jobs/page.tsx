import { getJobs } from '@/app/actions/jobs';
import { industryClass, jobStatusChipClass, jobStatusLabel } from '@/lib/jobs/badges';
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
    // CHUYỂN 09/2026 (audit CSS): bỏ div "page-container" bọc ngoài —
    // class ảo, không tồn tại trong CSS nào. main.content (root
    // layout.tsx) đã tự lo container/padding cho MỌI trang rồi.
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Career Hub / Quản lý</span>
          <h1>Danh sách Job</h1>
          <p className="lede">Tổng {total} job trong database</p>
        </div>
        {/* Bỏ div "page-head-actions" bọc ngoài (cũng là class ảo) —
            .page-head vốn đã là flex justify-content: space-between,
            nút chỉ cần là con trực tiếp (xem templates/index.html gốc). */}
        <Link href="/jobs/new" className="btn btn-primary">
          + Thêm Job Mới
        </Link>
      </div>

      {/* Filters - TODO: Implement later */}
      <form className="filter-bar" method="get" action="/jobs">
        <input
          type="search"
          name="search"
          placeholder="Tìm theo tên job..."
          defaultValue={resolvedSearchParams.search}
        />
        <select name="status" defaultValue={resolvedSearchParams.status || ''}>
          <option value="">Tất cả trạng thái</option>
          <option value="OPEN">Đang tuyển</option>
          <option value="CLOSED">Đã đóng</option>
        </select>
        <button type="submit" className="btn btn-ghost">Lọc</button>
        {(resolvedSearchParams.search || resolvedSearchParams.status) && (
          <Link href="/jobs" className="btn btn-text">Xóa bộ lọc</Link>
        )}
      </form>

      {jobs.length > 0 ? (
        <>
          <p className="result-count">
            Hiển thị {offset + 1}–{offset + jobs.length} / {total} job phù hợp
          </p>

          {/* CHUYỂN 09/2026: cấu trúc card viết lại đúng theo CSS thật
              (public/css/04-job-cards.css) — trước đây dùng cả bộ class
              tự đặt (job-card, job-card-header, job-title, job-company,
              job-meta, job-salary, job-deadline, job-card-footer) không
              khớp bất kỳ selector nào. Tên thật: <article class="ticket">
              > .ticket-stub (mã job/ngành/level) + .ticket-body
              (.ticket-top > h3+status-chip, .ticket-company,
              .ticket-meta, .ticket-actions). Xem templates/index.html
              (Flask gốc) để đối chiếu 1:1. */}
          <div className="job-grid job-grid-3col">
            {jobs.map((job) => (
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
                    {job.company_name || '—'}
                    {job.province_name ? ` · ${job.province_name}` : ''}
                  </p>

                  <div className="ticket-meta">
                    {(job.salary_min || job.salary_max) && (
                      <span>
                        💰 {job.salary_min?.toLocaleString() || '—'} - {job.salary_max?.toLocaleString() || '—'}{' '}
                        {job.currency || 'VNĐ'}
                      </span>
                    )}
                    {job.deadline && (
                      <span>📅 Hạn nộp: {new Date(job.deadline).toLocaleDateString('vi-VN')}</span>
                    )}
                    {job.source_name && job.source_name !== 'MANUAL' && (
                      <span>Nguồn: {job.source_name}</span>
                    )}
                  </div>

                  {/* Flask (.ticket-actions) còn có nút "Xem JD gốc ↗"
                      (job.jd_link) và "Lưu job" cho học viên ngay trên
                      card — Next.js hiện chưa làm 2 nút đó ở đây (chỉ có
                      ở trang chi tiết), để dành cho đợt sau, không tự
                      thêm tính năng mới trong đợt chỉ sửa tên class này. */}
                  <div className="ticket-actions">
                    <Link href={`/jobs/${job.job_id}`} className="btn btn-text">
                      Xem chi tiết
                    </Link>
                    <Link href={`/jobs/${job.job_id}/edit`} className="btn btn-ghost">
                      Sửa
                    </Link>
                  </div>
                </div>
              </article>
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
            <Link href="/jobs" className="btn btn-text">Xóa bộ lọc</Link>
          ) : (
            <Link href="/jobs/new" className="btn btn-primary">Thêm Job Đầu Tiên</Link>
          )}
        </div>
      )}
    </>
  );
}
