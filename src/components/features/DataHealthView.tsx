import Link from 'next/link';
import { getTranslations, getLocale } from 'next-intl/server';
import type { CompanyDataHealth, JobDataHealth, FieldHealthRow } from '@/types/crawl';
import { toIntlLocale } from '@/i18n/config';

/**
 * Tab "Tình trạng dữ liệu" ở trang /crawl — cho admin/ss_team thấy
 * nhanh company/job đang thiếu field gì/tỉ lệ bao nhiêu, KHÔNG cần vào
 * thẳng database. Chỉ đọc, không có form/route ghi nào — đúng theo
 * blueprints/crawl_status.py (Flask gốc).
 *
 * THÊM 09/2026 (rà soát #3, chat139) — module còn thiếu hoàn toàn ở
 * Next.js trước đợt này. Dùng CSS đã có sẵn (.status-card-title,
 * 15-crawl.css) + .contact-table-wrap/.contact-table dùng chung nhiều
 * trang khác trong repo (không tự bịa class mới).
 *
 * i18n (đợt sau, 09/2026 — rà soát lại nhóm 5): module này bị BỎ SÓT ở
 * đợt dịch component trước (không nằm trong danh sách 7 component đã
 * dịch dù cùng thư mục `features/`). Chuyển thành async function để
 * gọi `getTranslations('dataHealthView')` (Server Component, không có
 * `'use client'`). `toLocaleDateString()` giờ dùng `dateLocale` theo
 * locale hiện tại (Polish, 09/2026) thay vì hard-code `'vi-VN'`.
 */

function FieldHealthTable({
  rows,
  total,
  t,
}: {
  rows: FieldHealthRow[];
  total: number;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  if (rows.length === 0) {
    return <p className="muted">{t('noData')}</p>;
  }
  return (
    <div className="contact-table-wrap">
      <table className="contact-table">
        <thead>
          <tr>
            <th>{t('fieldColumn')}</th>
            <th>{t('missingColumn')}</th>
            <th>{t('totalColumn')}</th>
            <th>{t('missingRateColumn')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.field}>
              <td>{row.label}</td>
              <td className="muted">{row.missing}</td>
              <td className="muted">{row.total || total}</td>
              <td>
                <span className={`badge ${row.pct_missing >= 50 ? 'badge-danger' : row.pct_missing > 0 ? 'badge-warning' : 'badge-success'}`}>
                  {row.pct_missing}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface DataHealthViewProps {
  companyHealth: CompanyDataHealth;
  jobHealth: JobDataHealth;
}

export default async function DataHealthView({ companyHealth, jobHealth }: DataHealthViewProps) {
  const t = await getTranslations('dataHealthView');
  const dateLocale = toIntlLocale(await getLocale());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div className="card">
        <h2 className="status-card-title">
          {t('companyMissingTitle', { total: companyHealth.company_health_total })}
        </h2>
        <FieldHealthTable rows={companyHealth.company_health_rows} total={companyHealth.company_health_total} t={t} />
        <p className="muted" style={{ marginTop: '14px', marginBottom: 0 }}>
          <strong>{companyHealth.company_no_contact_missing}</strong> / {companyHealth.company_no_contact_total}{' '}
          {t('companyNoContactSuffix')}
        </p>
      </div>

      <div className="card">
        <h2 className="status-card-title">{t('jobMissingTitle', { total: jobHealth.job_health_total })}</h2>
        <FieldHealthTable rows={jobHealth.job_health_rows} total={jobHealth.job_health_total} t={t} />
      </div>

      {jobHealth.job_health_by_source.length > 0 && (
        <div className="card">
          <h2 className="status-card-title">{t('missingBySourceTitle')}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {jobHealth.job_health_by_source.map((src) => (
              <div key={src.source}>
                <h4 style={{ marginBottom: '8px' }}>{src.source} ({src.total})</h4>
                <FieldHealthTable rows={src.rows} total={src.total} t={t} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="status-card-title">
          {t('expiredOpenJobsTitle', { count: jobHealth.expired_open_jobs.length })}
        </h2>
        {jobHealth.expired_open_jobs.length === 0 ? (
          <p className="muted">{t('noExpiredJobs')}</p>
        ) : (
          <div className="contact-table-wrap">
            <table className="contact-table">
              <thead>
                <tr>
                  <th>{t('positionColumn')}</th>
                  <th>{t('companyColumn')}</th>
                  <th>{t('deadlineColumn')}</th>
                  <th>{t('sourceColumn')}</th>
                </tr>
              </thead>
              <tbody>
                {jobHealth.expired_open_jobs.map((j) => (
                  <tr key={j.id}>
                    <td><Link href={`/jobs/${j.id}`}>{j.position}</Link></td>
                    <td className="muted">{j.company}</td>
                    <td className="muted">{j.deadline ? new Date(j.deadline).toLocaleDateString(dateLocale) : '—'}</td>
                    <td className="muted">{j.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="status-card-title">
          {t('duplicateJobsTitle', { count: jobHealth.duplicate_job_groups.length })}
        </h2>
        {jobHealth.duplicate_job_groups.length === 0 ? (
          <p className="muted">{t('noDuplicateJobs')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {jobHealth.duplicate_job_groups.map((group, idx) => (
              <div key={`${group.company}-${group.position}-${idx}`}>
                <h4 style={{ marginBottom: '8px' }}>{group.company} — {group.position}</h4>
                <div className="contact-table-wrap">
                  <table className="contact-table">
                    <thead>
                      <tr>
                        <th>{t('positionColumn')}</th>
                        <th>{t('deadlineColumn')}</th>
                        <th>{t('sourceColumn')}</th>
                        <th>{t('suggestionColumn')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.jobs.map((j) => (
                        <tr key={j.id}>
                          <td><Link href={`/jobs/${j.id}`}>{j.position}</Link></td>
                          <td className="muted">{j.deadline ? new Date(j.deadline).toLocaleDateString(dateLocale) : '—'}</td>
                          <td className="muted">{j.source}</td>
                          <td>
                            {j.suggest_keep === true && <span className="badge badge-success">{t('suggestKeep')}</span>}
                            {j.suggest_keep === false && <span className="badge badge-warning">{t('suggestClose')}</span>}
                            {(j.suggest_keep === null || j.suggest_keep === undefined) && <span className="muted">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
