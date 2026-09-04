'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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
      setError('Vui lòng chọn file CV (.pdf).');
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
      setError(result.error || 'Không thể ứng tuyển job này');
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
      setError(result.error || 'Không thể rút hồ sơ');
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
      setError(result.error || 'Không thể cập nhật trạng thái lưu job');
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
          className="btn btn-block btn-secondary"
        >
          {isWithdrawing ? 'Đang rút hồ sơ...' : '✅ Đã ứng tuyển — Rút hồ sơ'}
        </button>
      ) : isOpen ? (
        showApplyForm ? (
          <form onSubmit={handleApplySubmit} className="card" style={{ padding: '16px' }}>
            <div className="form-group">
              <label htmlFor="cv_file">File CV (.pdf, tối đa 5MB) *</label>
              <input
                ref={fileInputRef}
                id="cv_file"
                name="cv_file"
                type="file"
                accept=".pdf"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="apply_note">Ghi chú (tuỳ chọn)</label>
              <textarea
                id="apply_note"
                name="apply_note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Vài dòng giới thiệu bản thân..."
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" disabled={isApplying} className="btn btn-primary" style={{ flex: 1 }}>
                {isApplying ? 'Đang gửi...' : 'Gửi hồ sơ ứng tuyển'}
              </button>
              <button
                type="button"
                disabled={isApplying}
                onClick={() => setShowApplyForm(false)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Huỷ
              </button>
            </div>
          </form>
        ) : (
          <button onClick={() => setShowApplyForm(true)} className="btn btn-block btn-primary">
            📝 Ứng tuyển
          </button>
        )
      ) : (
        <button disabled className="btn btn-block" title="Job đã đóng, không thể ứng tuyển">
          Job đã đóng — không thể ứng tuyển
        </button>
      )}

      {/* Lưu / Bỏ lưu — luôn cho phép, kể cả job đã CLOSED */}
      <button onClick={handleToggleSave} disabled={isSaving} className="btn btn-block btn-secondary">
        {isSaving ? 'Đang xử lý...' : saved ? '★ Đã lưu — Bỏ lưu' : '☆ Lưu job'}
      </button>
    </div>
  );
}
