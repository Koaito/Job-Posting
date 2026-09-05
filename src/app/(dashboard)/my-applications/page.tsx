import { getMyApplications } from '@/app/actions/me';
import Link from 'next/link';
import WithdrawApplicationButton from '@/components/features/WithdrawApplicationButton';
import { jobStatusChipClass, jobStatusLabel } from '@/lib/jobs/badges';

/**
 * My Applications Page (Đơn ứng tuyển của tôi)
 * Corresponds to Flask: blueprints/my_stuff.py (templates/my_applications.html)
 * Route: /my-applications
 *
 * Mới 09/2026 (Phase 3.6) — trước đây route này hoàn toàn không tồn tại
 * ở Next.js, học viên chưa xem được danh sách đơn đã ứng tuyển.
 */

export default async function MyApplicationsPage() {
  const applications = await getMyApplications();

  return (
    // BUG FIX (audit CSS 09/2026): bỏ "page-container" ảo.
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Trang cá nhân</span>
          <h1>Đơn ứng tuyển của tôi</h1>
          <p className="lede">Danh sách job bạn đã ứng tuyển và trạng thái xử lý.</p>
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="card">
          <p className="muted">Bạn chưa ứng tuyển job nào.</p>
          <Link href="/jobs" className="btn btn-primary" style={{ marginTop: '12px' }}>
            Tìm job để ứng tuyển
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
                        <dt>Trạng thái job</dt>
                        <dd>
                          <span className={`status-chip ${jobStatusChipClass(app.job_status)}`}>
                            {jobStatusLabel(app.job_status)}
                          </span>
                        </dd>
                      </>
                    )}
                    <dt>Ngày ứng tuyển</dt>
                    <dd>{new Date(app.applied_at).toLocaleDateString('vi-VN')}</dd>
                    {app.note && (
                      <>
                        <dt>Ghi chú</dt>
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
