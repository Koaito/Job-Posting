import { getMyApplications } from '@/app/actions/me';
import { getCurrentUser } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations, getLocale } from 'next-intl/server';
import WithdrawApplicationButton from '@/components/features/WithdrawApplicationButton';
import { jobStatusChipClass, jobStatusLabel } from '@/lib/jobs/badges';
import { toIntlLocale } from '@/i18n/config';

/**
 * My Applications Page (Đơn ứng tuyển của tôi)
 * Corresponds to Flask: blueprints/my_stuff.py (templates/my_applications.html)
 * Route: /my-applications
 *
 * Mới 09/2026 (Phase 3.6) — trước đây route này hoàn toàn không tồn tại
 * ở Next.js, học viên chưa xem được danh sách đơn đã ứng tuyển.
 *
 * BUG FIX (audit 09/2026 "rà toàn bộ codebase #1"): trang này (và
 * /saved-jobs) trước đây KHÔNG tự check đăng nhập — đồng thời cũng bị
 * bỏ sót khỏi middleware.ts (đã sửa riêng ở đó). Khách chưa đăng nhập
 * vào thẳng URL sẽ gọi getMyApplications() -> backend trả 401 ->
 * action nuốt lỗi thành mảng rỗng (xem actions/me.ts, cố ý giữ nguyên
 * hành vi đó cho các nơi gọi khác đã tự check quyền trước, vd
 * jobs/[id]/page.tsx) -> khách thấy y hệt "Bạn chưa ứng tuyển job nào"
 * như user thật, không được yêu cầu đăng nhập. Thêm check
 * getCurrentUser() + redirect('/login') ở đây, khớp đúng pattern mọi
 * trang khác trong (dashboard)/ đã dùng (vd profile/page.tsx) — không
 * sửa actions/me.ts vì hành vi "trả [] khi lỗi" vẫn đúng cho các nơi
 * gọi khác.
 */

export default async function MyApplicationsPage() {
  const t = await getTranslations('myApplicationsPage');
  const tJobStatus = await getTranslations('jobStatus');
  const dateLocale = toIntlLocale(await getLocale());
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const applications = await getMyApplications();

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

      {applications.length === 0 ? (
        <div className="card">
          <p className="muted">{t('empty')}</p>
          <Link href="/jobs" className="btn btn-primary" style={{ marginTop: '12px' }}>
            {t('findJobs')}
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {applications.map((app) => (
            <div key={app.application_id} className="card">
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
                    {/* BUG FIX (audit CSS 09/2026): bỏ class "link" (ảo) —
                        không cần, thẻ <a> trong <h3> đã đủ nổi bật. */}
                    <Link href={`/jobs/${app.job_id}`}>
                      {app.job_title}
                    </Link>
                  </h3>
                  <p className="muted" style={{ margin: '0 0 8px 0' }}>{app.company_name}</p>
                  {/* BUG FIX: "detail-list" -> "kv" (class thật, xem fix
                      ở jobs/[id]/page.tsx). "status-chip status-open/
                      status-closed" cũng là bug y hệt jobs/page.tsx —
                      dùng lại helper thật lib/jobs/badges.ts thay vì tự
                      lowercase job_status. */}
                  <dl className="kv">
                    {app.job_status && (
                      <>
                        <dt>{t('jobStatus')}</dt>
                        <dd>
                          <span className={`status-chip ${jobStatusChipClass(app.job_status)}`}>
                            {jobStatusLabel(app.job_status, tJobStatus)}
                          </span>
                        </dd>
                      </>
                    )}
                    <dt>{t('appliedAt')}</dt>
                    {/* Polish (09/2026): dateLocale theo locale hiện tại
                        thay vì hard-code 'vi-VN'. */}
                    <dd>{new Date(app.applied_at).toLocaleDateString(dateLocale)}</dd>
                    {app.note && (
                      <>
                        <dt>{t('note')}</dt>
                        <dd>{app.note}</dd>
                      </>
                    )}
                  </dl>
                </div>
                <WithdrawApplicationButton jobId={app.job_id} jobTitle={app.job_title} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
