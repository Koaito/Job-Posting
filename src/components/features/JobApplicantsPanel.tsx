'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('jobApplicantsPanel');
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
      setError(result.error || t('cvLoadFailed'));
    }
  }

  return (
    <section className="card">
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button
          onClick={() => setTab('applicants')}
          className={tab === 'applicants' ? 'btn btn-primary' : 'btn btn-ghost'}
        >
          {t('applicantsTab', { count: applicants.length })}
        </button>
        <button
          onClick={() => setTab('savers')}
          className={tab === 'savers' ? 'btn btn-primary' : 'btn btn-ghost'}
        >
          {t('saversTab', { count: savers.length })}
        </button>
      </div>

      {error && <div className="flash flash-error" style={{ marginBottom: '12px' }}>{error}</div>}

      {tab === 'applicants' ? (
        applicants.length === 0 ? (
          <p className="muted">{t('noApplicants')}</p>
        ) : (
          <div className="contact-table-wrap">
            <table className="contact-table">
            <thead>
              <tr>
                <th>{t('colName')}</th>
                <th>{t('colEmail')}</th>
                <th>{t('colPhone')}</th>
                <th>{t('colNote')}</th>
                <th>{t('colAppliedAt')}</th>
                <th>{t('colCv')}</th>
              </tr>
            </thead>
            <tbody>
              {applicants.map((a) => (
                <tr key={a.application_id}>
                  <td>{a.full_name}</td>
                  <td>{a.email}</td>
                  <td>{a.phone || '—'}</td>
                  <td>{a.note || '—'}</td>
                  {/* CỐ Ý CHƯA dịch: toLocaleDateString('vi-VN') — thuộc
                      phạm vi Polish, không xử lý ở đợt Language này. */}
                  <td>{new Date(a.applied_at).toLocaleDateString('vi-VN')}</td>
                  <td>
                    {a.cv_url ? (
                      <button
                        onClick={() => handleViewCv(a.application_id)}
                        disabled={loadingCvId === a.application_id}
                        className="btn btn-ghost"
                      >
                        {loadingCvId === a.application_id ? t('loadingCv') : t('viewCv')}
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
        <p className="muted">{t('noSavers')}</p>
      ) : (
        <div className="contact-table-wrap">
          <table className="contact-table">
            <thead>
              <tr>
                <th>{t('colName')}</th>
                <th>{t('colEmail')}</th>
                <th>{t('colPhone')}</th>
                <th>{t('colSavedAt')}</th>
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
