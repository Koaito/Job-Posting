'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { applyToJob, withdrawApplication, saveJob, unsaveJob } from '@/app/actions/me';

/**
 * Nút "Ứng tuyển" + "Lưu job" trên trang chi tiết job, dành cho học viên
 * (role 'user'). Thêm 09/2026 (Phase 3.6) — trang chi tiết job trước đây
 * chỉ có nút "Sửa Job" dành cho staff, học viên đăng nhập vào không tự
 * làm được gì.
 *
 * Nhận sẵn trạng thái đã ứng tuyển/đã lưu từ Server Component cha (biết
 * trước qua getMyApplications()/getMySavedJobs()) để tránh nhấp nháy lúc
 * mới vào trang — component chỉ tự quản lý trạng thái SAU khi người dùng
 * tương tác.
 *
 * i18n (Giai đoạn 2, nhóm 5, 09/2026): dịch label/nút bấm qua
 * `useTranslations('jobApplyActions')`.
 */

interface JobApplyActionsProps {
  jobId: string;
  jobStatus: string; // 'OPEN' | 'CLOSED'
  initiallyApplied: boolean;
  initiallySaved: boolean;
}

export default function JobApplyActions({
  jobId,
  jobStatus,
  initiallyApplied,
  initiallySaved,
}: JobApplyActionsProps) {
  const t = useTranslations('jobApplyActions');
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [applied, setApplied] = useState(initiallyApplied);
  const [saved, setSaved] = useState(initiallySaved);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [note, setNote] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOpen = jobStatus === 'OPEN';

  async function handleApplySubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError(t('cvFileRequired'));
      return;
    }

    setIsApplying(true);
    const result = await applyToJob(jobId, file, note || undefined);
    setIsApplying(false);

    if (result.success) {
      setApplied(true);
      setShowApplyForm(false);
      setNote('');
      router.refresh();
    } else {
      setError(result.error || t('applyFailed'));
    }
  }

  async function handleWithdraw() {
    setError(null);
    setIsWithdrawing(true);
    const result = await withdrawApplication(jobId);
    setIsWithdrawing(false);

    if (result.success) {
      setApplied(false);
      router.refresh();
    } else {
      setError(result.error || t('withdrawFailed'));
    }
  }

  async function handleToggleSave() {
    setError(null);
    setIsSaving(true);
    const result = saved ? await unsaveJob(jobId) : await saveJob(jobId);
    setIsSaving(false);

    if (result.success) {
      setSaved(!saved);
    } else {
      setError(result.error || t('saveToggleFailed'));
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {error && (
        <div className="flash flash-error" style={{ marginBottom: '4px' }}>
          {error}
        </div>
      )}

      {/* Ứng tuyển / Rút hồ sơ */}
      {applied ? (
        <button
          onClick={handleWithdraw}
          disabled={isWithdrawing}
          className="btn btn-block btn-ghost"
        >
          {isWithdrawing ? t('withdrawing') : t('appliedWithdraw')}
        </button>
      ) : isOpen ? (
        showApplyForm ? (
          <form onSubmit={handleApplySubmit} className="card" style={{ padding: '16px' }}>
            {/* BUG FIX (audit CSS 09/2026): "form-group" không tồn tại
                trong CSS nào — convention thật là bọc trực tiếp bằng
                <label> (xem .form-grid > label, public/css/07-forms.css),
                không cần div wrapper riêng. */}
            <label htmlFor="cv_file" style={{ display: 'block', marginBottom: '12px' }}>
              {t('cvFileLabel')}
              <input
                ref={fileInputRef}
                id="cv_file"
                name="cv_file"
                type="file"
                accept=".pdf"
                required
              />
            </label>
            <label htmlFor="apply_note" style={{ display: 'block', marginBottom: '12px' }}>
              {t('noteLabel')}
              <textarea
                id="apply_note"
                name="apply_note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('notePlaceholder')}
              />
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" disabled={isApplying} className="btn btn-primary" style={{ flex: 1 }}>
                {isApplying ? t('sendingApplication') : t('submitApplication')}
              </button>
              <button
                type="button"
                disabled={isApplying}
                onClick={() => setShowApplyForm(false)}
                className="btn btn-ghost"
                style={{ flex: 1 }}
              >
                {t('cancel')}
              </button>
            </div>
          </form>
        ) : (
          <button onClick={() => setShowApplyForm(true)} className="btn btn-block btn-primary">
            {t('applyButton')}
          </button>
        )
      ) : (
        <button disabled className="btn btn-block" title={t('closedTitle')}>
          {t('closedButton')}
        </button>
      )}

      {/* Lưu / Bỏ lưu — luôn cho phép, kể cả job đã CLOSED */}
      <button onClick={handleToggleSave} disabled={isSaving} className="btn btn-block btn-ghost">
        {isSaving ? t('processing') : saved ? t('savedUnsave') : t('saveJob')}
      </button>
    </div>
  );
}
