import Link from 'next/link';
import { getTranslations, getLocale } from 'next-intl/server';
import type { PaginatedCrawlRuns, PaginatedMaintenanceRuns } from '@/types/crawl';
import { crawlStatusBadgeClass, crawlStatusLabel } from '@/lib/crawl/badges';
import { maintenanceJobLabel } from '@/lib/maintenance/jobs';
import { toIntlLocale } from '@/i18n/config';

/**
 * Tab "Lịch sử vận hành" ở /crawl — 2 bảng lịch sử (crawl + bảo trì)
 * xếp dọc, mỗi bảng phân trang/lọc RIÊNG (khớp blueprints/crawl_history.py
 * Flask gốc). Bảng crawl DỜI TỪ tab "crawl" sang đây (trước đợt này,
 * Next.js gộp chung trigger+lịch sử vào 1 tab duy nhất vì chưa có tab
 * nav — giờ tách đúng theo kiến trúc 4-tab thật của Flask).
 *
 * THÊM 09/2026 (rà soát #3, chat139).
 *
 * i18n (đợt sau, 09/2026 — rà soát lại nhóm 5): module này bị BỎ SÓT ở
 * đợt dịch component trước. Chuyển thành async function để gọi
 * `getTranslations('historyView')` (Server Component, không có
 * `'use client'`). crawlStatusLabel() dùng chung `t` namespace
 * `crawlStatus` — cùng đợt refactor với lib/crawl/badges.ts.
 * `toLocaleString()` giờ dùng `dateLocale` theo locale hiện tại (Polish,
 * 09/2026) thay vì hard-code `'vi-VN'`.
 *
 * i18n (đợt sau nữa, 09/2026): `maintenanceJobLabel()` (lib/maintenance/jobs.ts)
 * giờ nhận thêm `tMaintenanceJobs` — namespace mới `maintenanceJobs`,
 * cùng đợt tách label/description khỏi metadata tĩnh (xem ghi chú trong
 * file đó). Đã hết phần "CỐ Ý CHƯA dịch" ghi ở đây trước đây.
 */

const STATUS_OPTIONS = ['queued', 'running', 'done', 'error'];

interface HistoryViewProps {
  sources: string[];
  crawlRuns: PaginatedCrawlRuns;
  crawlPage: number;
  crawlLimit: number;
  crawlSource?: string;
  crawlStatus?: string;

  maintenanceRuns: PaginatedMaintenanceRuns;
  maintenancePage: number;
  maintenanceLimit: number;
  maintenanceJobType?: string;
  maintenanceStatus?: string;
}

function buildQs(base: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  params.set('tab', 'history');
  for (const [k, v] of Object.entries(base)) {
    if (v !== undefined && v !== '') params.set(k, String(v));
  }
  return `/crawl?${params}`;
}

export default async function HistoryView({
  sources,
  crawlRuns, crawlPage, crawlLimit, crawlSource, crawlStatus,
  maintenanceRuns, maintenancePage, maintenanceLimit, maintenanceJobType, maintenanceStatus,
}: HistoryViewProps) {
  const t = await getTranslations('historyView');
  const tCrawlStatus = await getTranslations('crawlStatus');
  const tMaintenanceJobs = await getTranslations('maintenanceJobs');
  const dateLocale = toIntlLocale(await getLocale());
  const crawlTotalPages = Math.max(1, Math.ceil(crawlRuns.total / crawlLimit));
  const maintTotalPages = Math.max(1, Math.ceil(maintenanceRuns.total / maintenanceLimit));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <section>
        <h4>{t('crawlHistoryTitle')}</h4>
        <div className="filter-bar" style={{ marginBottom: '16px' }}>
          <form method="get" action="/crawl" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <input type="hidden" name="tab" value="history" />
            <select name="c_source" defaultValue={crawlSource || ''}>
              <option value="">{t('allSources')}</option>
              {sources.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select name="c_status" defaultValue={crawlStatus || ''}>
              <option value="">{t('allStatuses')}</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{crawlStatusLabel(s, tCrawlStatus)}</option>
              ))}
            </select>
            <button type="submit" className="btn">{t('filterButton')}</button>
            {(crawlSource || crawlStatus) && <Link href="/crawl?tab=history" className="btn">{t('clearFilter')}</Link>}
          </form>
        </div>

        {crawlRuns.items.length > 0 ? (
          <>
            <div className="contact-table-wrap">
              <table className="contact-table">
                <thead>
                  <tr>
                    <th>{t('sourceColumn')}</th>
                    <th>{t('categoryColumn')}</th>
                    <th>{t('statusColumn')}</th>
                    <th>{t('triggeredByColumn')}</th>
                    <th>{t('startedAtColumn')}</th>
                    <th>{t('resultColumn')}</th>
                  </tr>
                </thead>
                <tbody>
                  {crawlRuns.items.map((run) => (
                    <tr key={run.run_id}>
                      <td>{run.source}</td>
                      <td className="muted">{run.category}</td>
                      <td>
                        <span className={`badge ${crawlStatusBadgeClass(run.status)}`}>{crawlStatusLabel(run.status, tCrawlStatus)}</span>
                      </td>
                      <td className="muted">{run.triggered_by_name || t('autoTriggered')}</td>
                      <td className="muted">{new Date(run.started_at).toLocaleString(dateLocale)}</td>
                      <td className="muted crawl-result-main">
                        {run.error ? (
                          <span className="crawl-error-text">{run.error}</span>
                        ) : run.stats ? (
                          <details className="crawl-result-details">
                            <summary>{t('viewDetails')}</summary>
                            <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap' }}>{JSON.stringify(run.stats, null, 2)}</pre>
                          </details>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {crawlTotalPages > 1 && (
              <div className="pagination">
                {crawlPage > 1 && (
                  <Link href={buildQs({ c_source: crawlSource, c_status: crawlStatus, c_page: crawlPage - 1 })} className="page-btn">{t('prevPage')}</Link>
                )}
                <span className="page-status">{t('pageStatus', { page: crawlPage, totalPages: crawlTotalPages })}</span>
                {crawlPage < crawlTotalPages && (
                  <Link href={buildQs({ c_source: crawlSource, c_status: crawlStatus, c_page: crawlPage + 1 })} className="page-btn">{t('nextPage')}</Link>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="empty-state"><p>{t('noCrawlRuns')}</p></div>
        )}
      </section>

      <section>
        <h4>{t('maintenanceHistoryTitle')}</h4>
        <div className="filter-bar" style={{ marginBottom: '16px' }}>
          <form method="get" action="/crawl" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <input type="hidden" name="tab" value="history" />
            <select name="m_job_type" defaultValue={maintenanceJobType || ''}>
              <option value="">{t('allJobs')}</option>
              {['backfill_company_profiles', 'enrich_profile_from_website', 'enrich_web_info', 'get_fb_linkedin', 'check_expired_jobs'].map((jt) => (
                <option key={jt} value={jt}>{maintenanceJobLabel(jt, tMaintenanceJobs)}</option>
              ))}
            </select>
            <select name="m_status" defaultValue={maintenanceStatus || ''}>
              <option value="">{t('allStatuses')}</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{crawlStatusLabel(s, tCrawlStatus)}</option>
              ))}
            </select>
            <button type="submit" className="btn">{t('filterButton')}</button>
            {(maintenanceJobType || maintenanceStatus) && <Link href="/crawl?tab=history" className="btn">{t('clearFilter')}</Link>}
          </form>
        </div>

        {maintenanceRuns.items.length > 0 ? (
          <>
            <div className="contact-table-wrap">
              <table className="contact-table">
                <thead>
                  <tr>
                    <th>{t('jobColumn')}</th>
                    <th>{t('statusColumn')}</th>
                    <th>{t('triggeredByColumn')}</th>
                    <th>{t('startedAtColumn')}</th>
                    <th>{t('resultColumn')}</th>
                  </tr>
                </thead>
                <tbody>
                  {maintenanceRuns.items.map((run) => (
                    <tr key={run.run_id}>
                      <td>{maintenanceJobLabel(run.job_type, tMaintenanceJobs)}</td>
                      <td>
                        <span className={`badge ${crawlStatusBadgeClass(run.status)}`}>{crawlStatusLabel(run.status, tCrawlStatus)}</span>
                      </td>
                      <td className="muted">{run.triggered_by_name || t('autoTriggered')}</td>
                      <td className="muted">{new Date(run.started_at).toLocaleString(dateLocale)}</td>
                      <td className="muted crawl-result-main">
                        {run.error ? (
                          <span className="crawl-error-text">{run.error}</span>
                        ) : run.stats ? (
                          <details className="crawl-result-details">
                            <summary>{t('viewDetails')}</summary>
                            <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap' }}>{JSON.stringify(run.stats, null, 2)}</pre>
                          </details>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {maintTotalPages > 1 && (
              <div className="pagination">
                {maintenancePage > 1 && (
                  <Link href={buildQs({ m_job_type: maintenanceJobType, m_status: maintenanceStatus, m_page: maintenancePage - 1 })} className="page-btn">{t('prevPage')}</Link>
                )}
                <span className="page-status">{t('pageStatus', { page: maintenancePage, totalPages: maintTotalPages })}</span>
                {maintenancePage < maintTotalPages && (
                  <Link href={buildQs({ m_job_type: maintenanceJobType, m_status: maintenanceStatus, m_page: maintenancePage + 1 })} className="page-btn">{t('nextPage')}</Link>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="empty-state"><p>{t('noMaintenanceRuns')}</p></div>
        )}
      </section>
    </div>
  );
}
