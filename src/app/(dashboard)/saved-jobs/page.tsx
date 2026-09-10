import { getMySavedJobs } from '@/app/actions/me';
import { getCurrentUser } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations, getLocale } from 'next-intl/server';
import UnsaveJobButton from '@/components/features/UnsaveJobButton';
import { jobStatusChipClass, jobStatusLabel } from '@/lib/jobs/badges';
import { toIntlLocale } from '@/i18n/config';

/**
 * Saved Jobs Page (Job đã lưu)
 * Corresponds to Flask: blueprints/my_stuff.py (templates/saved_jobs.html)
 * Route: /saved-jobs
 *
 * Mới 09/2026 (Phase 3.6) — trước đây route này hoàn toàn không tồn tại
 * ở Next.js. Job đã CLOSED vẫn hiển thị bình thường ở đây (lưu để xem
 * lại vẫn hợp lý dù không ứng tuyển được nữa).
 *
 * BUG FIX (audit 09/2026 "rà toàn bộ codebase #1"): xem giải thích đầy
 * đủ ở docstring my-applications/page.tsx — cùng 1 bug, cùng 1 cách sửa.
 */

export default async function SavedJobsPage() {
  const t = await getTranslations('savedJobsPage');
  const dateLocale = toIntlLocale(await getLocale());
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const savedJobs = await getMySavedJobs();

  return (
    // BUG FIX (audit CSS 09/2026): bỏ "page-container" ảo.
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">{t('eyebrow')}</span>
          <h1>{t('title')}</h1>
          <p className="lede">{t('lede')}</p>
        </div>
      </div>

      {savedJobs.length === 0 ? (
        <div className="card">
          <p className="muted">{t('empty')}</p>
          <Link href="/jobs" className="btn btn-primary" style={{ marginTop: '12px' }}>
            {t('findJobs')}
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {savedJobs.map((sj) => (
            <div key={sj.saved_job_id} className="card">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '12px',
                }}
              >
                <div>
                  <h3 style={{ margin: '0 0 4px 0' }}>
                    {/* BUG FIX (audit CSS 09/2026): bỏ class "link" (ảo). */}
                    <Link href={`/jobs/${sj.job_id}`}>
                      {sj.job_title}
                    </Link>
                  </h3>
                  <p className="muted" style={{ margin: '0 0 8px 0' }}>{sj.company_name}</p>
                  {/* BUG FIX: "detail-list" -> "kv"; "status-chip
                      status-open/status-closed" -> helper thật
                      lib/jobs/badges.ts (cùng bug jobs/page.tsx). */}
                  <dl className="kv">
                    {sj.job_status && (
                      <>
                        <dt>{t('jobStatus')}</dt>
                        <dd>
                          <span className={`status-chip ${jobStatusChipClass(sj.job_status)}`}>
                            {jobStatusLabel(sj.job_status)}
                          </span>
                        </dd>
                      </>
                    )}
                    <dt>{t('savedAt')}</dt>
                    {/* Polish (09/2026): dateLocale theo locale hiện tại
                        thay vì hard-code 'vi-VN'. */}
                    <dd>{new Date(sj.created_at).toLocaleDateString(dateLocale)}</dd>
                  </dl>
                </div>
                <UnsaveJobButton jobId={sj.job_id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
