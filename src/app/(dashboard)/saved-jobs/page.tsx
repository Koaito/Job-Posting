import { getMySavedJobs } from '@/app/actions/me';
import Link from 'next/link';
import UnsaveJobButton from '@/components/features/UnsaveJobButton';

/**
 * Saved Jobs Page (Job đã lưu)
 * Corresponds to Flask: blueprints/my_stuff.py (templates/saved_jobs.html)
 * Route: /saved-jobs
 *
 * Mới 09/2026 (Phase 3.6) — trước đây route này hoàn toàn không tồn tại
 * ở Next.js. Job đã CLOSED vẫn hiển thị bình thường ở đây (lưu để xem
 * lại vẫn hợp lý dù không ứng tuyển được nữa).
 */

export default async function SavedJobsPage() {
  const savedJobs = await getMySavedJobs();

  return (
    <div className="page-container">
      <div className="page-head">
        <div>
          <span className="eyebrow">Trang cá nhân</span>
          <h1>Job đã lưu</h1>
          <p className="lede">Danh sách job bạn đã lưu để xem lại sau.</p>
        </div>
      </div>

      {savedJobs.length === 0 ? (
        <div className="card">
          <p className="muted">Bạn chưa lưu job nào.</p>
          <Link href="/jobs" className="btn btn-primary" style={{ marginTop: '12px' }}>
            Tìm job để lưu
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
                    <Link href={`/jobs/${sj.job_id}`} className="link">
                      {sj.job_title}
                    </Link>
                  </h3>
                  <p className="muted" style={{ margin: '0 0 8px 0' }}>{sj.company_name}</p>
                  <dl className="detail-list">
                    {sj.job_status && (
                      <>
                        <dt>Trạng thái job</dt>
                        <dd>
                          <span className={`status-chip status-${sj.job_status.toLowerCase()}`}>
                            {sj.job_status === 'OPEN' ? 'Đang tuyển' : 'Đã đóng'}
                          </span>
                        </dd>
                      </>
                    )}
                    <dt>Ngày lưu</dt>
                    <dd>{new Date(sj.created_at).toLocaleDateString('vi-VN')}</dd>
                  </dl>
                </div>
                <UnsaveJobButton jobId={sj.job_id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
