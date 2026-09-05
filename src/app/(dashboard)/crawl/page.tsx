import Link from 'next/link';
import { getCrawlSources, getLatestCrawlRun, getCrawlHistory } from '@/app/actions/crawl';
import { getCurrentUser } from '@/app/actions/auth';
import { isStaffRole, isAdminRole } from '@/lib/auth/roles';
import CrawlTrigger from '@/components/features/CrawlTrigger';
import { crawlStatusBadgeClass, crawlStatusLabel } from '@/lib/crawl/badges';

/**
 * Crawl Page — kích hoạt crawl mới + log live + lịch sử crawl.
 * Corresponds to Flask: templates/crawl.html
 * Backend thật: api/routers/crawl.py.
 *
 * Mới 09/2026 — trước đây thư mục crawl/ hoàn toàn rỗng (404 thật, xem
 * Sidebar TODO). QUYỀN: xem trang (log/lịch sử) cần 'ss_team' trở lên;
 * BẤM kích hoạt crawl (POST /crawl) cần 'admin' — ẩn form cho ss_team
 * thường, hiện thông báo thay vì để bấm rồi nhận 403 (xem CrawlTrigger).
 */

interface SearchParams {
  source?: string;
  status?: string;
  page?: string;
}

const STATUS_OPTIONS = ['queued', 'running', 'done', 'error'];

export default async function CrawlPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const currentUser = await getCurrentUser();
  const isStaff = isStaffRole(currentUser?.role);

  if (!isStaff) {
    return (
      // BUG FIX (audit CSS 09/2026): bỏ "page-container" ảo.
      <>
        <div className="page-head">
          <h1>Crawler</h1>
        </div>
        <div className="empty-state">
          <p>Trang này chỉ dành cho nhân viên (ss_team/admin).</p>
        </div>
      </>
    );
  }

  const page = parseInt(sp.page || '1');
  const limit = 20;
  const offset = (page - 1) * limit;

  const [sources, latestRun, history] = await Promise.all([
    getCrawlSources(),
    getLatestCrawlRun(),
    getCrawlHistory({ source: sp.source, status: sp.status, limit, offset }),
  ]);

  const { items: runs, total } = history;
  const totalPages = Math.ceil(total / limit);
  const hasFilters = Boolean(sp.source || sp.status);
  const qs = (p: number) =>
    `/crawl?page=${p}` + (sp.source ? `&source=${sp.source}` : '') + (sp.status ? `&status=${sp.status}` : '');

  return (
    // BUG FIX (audit CSS 09/2026): bỏ "page-container" ảo.
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Career Hub / Quản lý</span>
          <h1>Crawler</h1>
          <p className="lede">Kích hoạt crawl JD mới + theo dõi tiến độ/lịch sử.</p>
        </div>
      </div>

      <CrawlTrigger isAdmin={isAdminRole(currentUser?.role)} sources={sources} initialRun={latestRun} />

      <section style={{ marginTop: '28px' }}>
        <h4>Lịch sử crawl</h4>

        <div className="filter-bar" style={{ marginBottom: '16px' }}>
          <form method="get" action="/crawl" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <select name="source" defaultValue={sp.source || ''}>
              <option value="">Mọi nguồn</option>
              {Object.keys(sources).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select name="status" defaultValue={sp.status || ''}>
              <option value="">Mọi trạng thái</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button type="submit" className="btn">Lọc</button>
            {hasFilters && <Link href="/crawl" className="btn">Xoá lọc</Link>}
          </form>
        </div>

        {runs.length > 0 ? (
          <>
            <div className="contact-table-wrap">
              <table className="contact-table">
                <thead>
                  <tr>
                    <th>Nguồn</th>
                    <th>Ngành</th>
                    <th>Trạng thái</th>
                    <th>Người kích hoạt</th>
                    <th>Bắt đầu</th>
                    <th>Kết quả</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.run_id}>
                      <td>{run.source}</td>
                      <td className="muted">{run.category}</td>
                      <td>
                        {/* BUG FIX (audit CSS 09/2026): cùng bug với
                            CrawlTrigger.tsx — "status-chip status-open/
                            status-closed" là class domain job, mượn sai
                            cho crawl. Dùng lại helper thật
                            (lib/crawl/badges.ts, khớp CRAWL_STATUS_BADGE/
                            CRAWL_STATUS_LABELS — crawler_client/crawl.py). */}
                        <span className={`badge ${crawlStatusBadgeClass(run.status)}`}>
                          {crawlStatusLabel(run.status)}
                        </span>
                      </td>
                      <td className="muted">{run.triggered_by_name || 'Tự động'}</td>
                      <td className="muted">{new Date(run.started_at).toLocaleString('vi-VN')}</td>
                      <td className="muted">
                        {run.error ? (
                          <span style={{ color: '#B23A22' }}>{run.error}</span>
                        ) : run.stats ? (
                          JSON.stringify(run.stats)
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                {page > 1 && <Link href={qs(page - 1)} className="page-btn">← Trang trước</Link>}
                <span className="page-status">Trang {page} / {totalPages}</span>
                {page < totalPages && <Link href={qs(page + 1)} className="page-btn">Trang sau →</Link>}
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            <p>Chưa có lượt crawl nào khớp bộ lọc.</p>
          </div>
        )}
      </section>
    </>
  );
}
