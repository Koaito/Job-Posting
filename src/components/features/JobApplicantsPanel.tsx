'use client';

import { useState } from 'react';
import { getCvSignedUrl } from '@/app/actions/me';
import type { JobApplicant, JobSaver } from '@/types/auth';

/**
 * Tab "Người đã ứng tuyển / Đã lưu" trên trang chi tiết job, dành cho
 * staff (role ss_team+). Thêm 09/2026 (Phase 3.6). Dữ liệu (applicants,
 * savers) được fetch sẵn ở Server Component cha (getJobApplicants()/
 * getJobSavers()) — component này chỉ render + xử lý nút tải CV (cần gọi
 * action lấy signed URL tại thời điểm bấm, không fetch trước vì signed
 * URL có hạn dùng ngắn).
 */

interface JobApplicantsPanelProps {
  applicants: JobApplicant[];
  savers: JobSaver[];
}

export default function JobApplicantsPanel({ applicants, savers }: JobApplicantsPanelProps) {
  const [tab, setTab] = useState<'applicants' | 'savers'>('applicants');
  const [loadingCvId, setLoadingCvId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleViewCv(applicationId: string) {
    setError(null);
    setLoadingCvId(applicationId);
    const result = await getCvSignedUrl(applicationId);
    setLoadingCvId(null);

    if (result.success && result.signedUrl) {
      window.open(result.signedUrl, '_blank', 'noopener,noreferrer');
    } else {
      setError(result.error || 'Không thể tải CV lúc này');
    }
  }

  return (
    <section className="card">
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button
          onClick={() => setTab('applicants')}
          className={tab === 'applicants' ? 'btn btn-primary' : 'btn btn-ghost'}
        >
          Người đã ứng tuyển ({applicants.length})
        </button>
        <button
          onClick={() => setTab('savers')}
          className={tab === 'savers' ? 'btn btn-primary' : 'btn btn-ghost'}
        >
          Người đã lưu ({savers.length})
        </button>
      </div>

      {error && <div className="flash flash-error" style={{ marginBottom: '12px' }}>{error}</div>}

      {tab === 'applicants' ? (
        applicants.length === 0 ? (
          <p className="muted">Chưa có ai ứng tuyển job này.</p>
        ) : (
          <div className="contact-table-wrap">
            <table className="contact-table">
            <thead>
              <tr>
                <th>Họ tên</th>
                <th>Email</th>
                <th>SĐT</th>
                <th>Ghi chú</th>
                <th>Ngày ứng tuyển</th>
                <th>CV</th>
              </tr>
            </thead>
            <tbody>
              {applicants.map((a) => (
                <tr key={a.application_id}>
                  <td>{a.full_name}</td>
                  <td>{a.email}</td>
                  <td>{a.phone || '—'}</td>
                  <td>{a.note || '—'}</td>
                  <td>{new Date(a.applied_at).toLocaleDateString('vi-VN')}</td>
                  <td>
                    {a.cv_url ? (
                      <button
                        onClick={() => handleViewCv(a.application_id)}
                        disabled={loadingCvId === a.application_id}
                        className="btn btn-ghost"
                      >
                        {loadingCvId === a.application_id ? 'Đang tải...' : 'Xem CV'}
                      </button>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        )
      ) : savers.length === 0 ? (
        <p className="muted">Chưa có ai lưu job này.</p>
      ) : (
        <div className="contact-table-wrap">
          <table className="contact-table">
            <thead>
              <tr>
                <th>Họ tên</th>
                <th>Email</th>
                <th>SĐT</th>
                <th>Ngày lưu</th>
              </tr>
            </thead>
            <tbody>
              {savers.map((s) => (
                <tr key={s.saved_job_id}>
                  <td>{s.full_name}</td>
                  <td>{s.email}</td>
                  <td>{s.phone || '—'}</td>
                  <td>{new Date(s.created_at).toLocaleDateString('vi-VN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
