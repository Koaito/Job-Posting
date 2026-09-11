import { getJobs } from '@/app/actions/jobs';
import { industryClass, industryLabel, jobStatusChipClass, jobStatusLabel } from '@/lib/jobs/badges';
import Link from 'next/link';
import { getTranslations, getLocale } from 'next-intl/server';
import { toIntlLocale } from '@/i18n/config';

/**
 * Jobs List Page
 * Corresponds to Flask: templates/index.html (jobs list)
 * Route: /jobs
 *
 * BUG FIX (audit 09/2026 "rà toàn bộ codebase #3"): trước đây chỉ có
 * filter "search" (keyword) + "status" — Flask gốc (templates/index.html)
 * có ĐỦ 5 filter: q (keyword), industry, level, location (province),
 * status. `JobFilters` (types/jobs.ts) + `getJobs()` (actions/jobs.ts)
 * ĐÃ hỗ trợ sẵn industry/level/province từ trước — chỉ chưa có UI
 * dropdown tương ứng ở đây, thuần thiếu sót (comment "TODO: Implement
 * later" bên dưới đã lỗi thời — filter cơ bản đã làm từ lâu nhưng
 * comment không được xoá, dễ gây hiểu nhầm là chưa làm gì). Thêm đủ 3
 * dropdown còn thiếu, dùng lại ĐÚNG bộ giá trị enum mà JobForm.tsx đã
 * dùng (matching_industry/level_code/province_name) để không tạo ra 2
 * nguồn "danh sách hợp lệ" lệch nhau giữa form tạo job và form lọc job.
 */

// Trùng khớp có chủ ý với JobForm.tsx (matching_industry/level_code/
// province_name) — backend hiện chưa có endpoint /enums thật (xem TODO
// trong JobForm.tsx), nên cả 2 nơi đều tạm hard-code cùng 1 bộ giá trị.
const INDUSTRY_OPTIONS = [
  'CNTT - Phần mềm',
  'Marketing - PR',
  'Kinh doanh - Bán hàng',
  'Thiết kế - Mỹ thuật',
  'Khác',
];
const LEVEL_OPTIONS = ['Intern', 'Fresher', 'Junior', 'Middle', 'Senior', 'Lead', 'Manager'];
const PROVINCE_OPTIONS = ['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng'] as const;

// i18n (Giai đoạn 2 Phần 3, 09/2026): cùng cách map value -> key đã
// dùng ở CompanyForm.tsx/companies/page.tsx — value gửi lên backend
// (query param ?province=...) giữ nguyên tiếng Việt, chỉ TEXT hiển thị
// đổi theo locale.
const PROVINCE_LABEL_KEY: Record<(typeof PROVINCE_OPTIONS)[number], 'hanoi' | 'hcm' | 'danang'> = {
  'Hà Nội': 'hanoi',
  'Hồ Chí Minh': 'hcm',
  'Đà Nẵng': 'danang',
};

interface SearchParams {
  search?: string;
  industry?: string;
  level?: string;
  province?: string;
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
  const t = await getTranslations('jobsPage');
  const tp = await getTranslations('provinces');
  const ti = await getTranslations('industries');
  const tJobStatus = await getTranslations('jobStatus');
  const dateLocale = toIntlLocale(await getLocale());
  const sp = await searchParams;
  const page = parseInt(sp.page || '1');
  const limit = 50;
  const offset = (page - 1) * limit;

  // BUG FIX (audit 09/2026): ô "Tìm theo tên job" gửi field "search"
  // (tên form input, giữ nguyên cho UI) nhưng backend GET /jobs chờ
  // param "keyword" — map lại đúng tên khi gọi getJobs(), nếu không lọc
  // bị bỏ qua trong im lặng dù form không báo lỗi gì.
  const { items: jobs, total } = await getJobs({
    keyword: sp.search,
    industry: sp.industry,
    level: sp.level,
    province: sp.province,
    status: sp.status,
    limit,
    offset,
  });

  const totalPages = Math.ceil(total / limit);
  const hasFilters = !!(sp.search || sp.industry || sp.level || sp.province || sp.status);

  // Dùng lại đúng 1 chỗ để build query string cho cả nút "Lọc" (ẩn,
  // form tự submit GET) lẫn link phân trang — trước đây phân trang chỉ
  // giữ lại search/status, thêm filter mới mà không sửa link phân
  // trang sẽ làm mất filter khi bấm "Trang sau" (bug tương tự đã từng
  // gặp ở /activity, xem qs() bên đó).
  const qs = (overrides: Partial<SearchParams>) => {
    const merged = { ...sp, ...overrides };
    const params = new URLSearchParams();
    if (merged.search) params.append('search', merged.search);
    if (merged.industry) params.append('industry', merged.industry);
    if (merged.level) params.append('level', merged.level);
    if (merged.province) params.append('province', merged.province);
    if (merged.status) params.append('status', merged.status);
    if (merged.page) params.append('page', merged.page);
    return `/jobs?${params}`;
  };

  return (
    // CHUYỂN 09/2026 (audit CSS): bỏ div "page-container" bọc ngoài —
    // class ảo, không tồn tại trong CSS nào. main.content (root
    // layout.tsx) đã tự lo container/padding cho MỌI trang rồi.
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">{t('eyebrow')}</span>
          <h1>{t('title')}</h1>
          <p className="lede">{t('lede', { total })}</p>
        </div>
        {/* Bỏ div "page-head-actions" bọc ngoài (cũng là class ảo) —
            .page-head vốn đã là flex justify-content: space-between,
            nút chỉ cần là con trực tiếp (xem templates/index.html gốc). */}
        <Link href="/jobs/new" className="btn btn-primary">
          {t('addNew')}
        </Link>
      </div>

      <form className="filter-bar" method="get" action="/jobs">
        <input
          type="search"
          name="search"
          placeholder={t('searchPlaceholder')}
          defaultValue={sp.search}
        />
        <select name="industry" defaultValue={sp.industry || ''}>
          <option value="">{t('allIndustries')}</option>
          {INDUSTRY_OPTIONS.map((i) => (
            <option key={i} value={i}>{industryLabel(i, ti)}</option>
          ))}
        </select>
        <select name="level" defaultValue={sp.level || ''}>
          <option value="">{t('allLevels')}</option>
          {LEVEL_OPTIONS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <select name="province" defaultValue={sp.province || ''}>
          <option value="">{t('allProvinces')}</option>
          {PROVINCE_OPTIONS.map((p) => (
            <option key={p} value={p}>{tp(PROVINCE_LABEL_KEY[p])}</option>
          ))}
        </select>
        <select name="status" defaultValue={sp.status || ''}>
          <option value="">{t('allStatuses')}</option>
          <option value="OPEN">{t('statusOpen')}</option>
          <option value="CLOSED">{t('statusClosed')}</option>
        </select>
        <button type="submit" className="btn btn-ghost">{t('filterButton')}</button>
        {hasFilters && <Link href="/jobs" className="btn btn-text">{t('clearFilters')}</Link>}
      </form>

      {jobs.length > 0 ? (
        <>
          <p className="result-count">
            {t('resultCount', { from: offset + 1, to: offset + jobs.length, total })}
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
                      {industryLabel(job.matching_industry, ti)}
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
                      {jobStatusLabel(job.job_status, tJobStatus)}
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
                        {job.currency || t('currencyDefault')}
                      </span>
                    )}
                    {job.deadline && (
                      // Polish (09/2026): dateLocale theo locale hiện tại
                      // thay vì hard-code 'vi-VN'.
                      <span>📅 {t('deadline', { date: new Date(job.deadline).toLocaleDateString(dateLocale) })}</span>
                    )}
                    {job.source_name && job.source_name !== 'MANUAL' && (
                      <span>{t('source', { source: job.source_name })}</span>
                    )}
                  </div>

                  {/* Flask (.ticket-actions) còn có nút "Xem JD gốc ↗"
                      (job.jd_link) và "Lưu job" cho học viên ngay trên
                      card — Next.js hiện chưa làm 2 nút đó ở đây (chỉ có
                      ở trang chi tiết), để dành cho đợt sau, không tự
                      thêm tính năng mới trong đợt chỉ sửa tên class này. */}
                  <div className="ticket-actions">
                    <Link href={`/jobs/${job.job_id}`} className="btn btn-text">
                      {t('viewDetail')}
                    </Link>
                    <Link href={`/jobs/${job.job_id}/edit`} className="btn btn-ghost">
                      {t('edit')}
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
                <Link href={qs({ page: String(page - 1) })} className="page-btn">
                  {t('prevPage')}
                </Link>
              )}

              <span className="page-status">
                {t('pageStatus', { page, totalPages })}
              </span>

              {page < totalPages && (
                <Link href={qs({ page: String(page + 1) })} className="page-btn">
                  {t('nextPage')}
                </Link>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <p>{t('empty')}</p>
          {hasFilters ? (
            <Link href="/jobs" className="btn btn-text">{t('clearFilters')}</Link>
          ) : (
            <Link href="/jobs/new" className="btn btn-primary">{t('addFirst')}</Link>
          )}
        </div>
      )}
    </>
  );
}
