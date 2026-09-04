'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { withdrawApplication } from '@/app/actions/me';

/**
 * Nút "Rút hồ sơ" dùng ở trang /my-applications — kèm modal nhập lý do
 * (note, tuỳ chọn), cùng pattern xác nhận với DeleteJobButton.tsx. Thêm
 * 09/2026 (Phase 3.6).
 */

interface WithdrawApplicationButtonProps {
  jobId: string;
  jobTitle: string;
}

export default function WithdrawApplicationButton({ jobId, jobTitle }: WithdrawApplicationButtonProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [note, setNote] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleWithdraw() {
    setIsWithdrawing(true);
    setError(null);
    const result = await withdrawApplication(jobId, note || undefined);
    setIsWithdrawing(false);

    if (result.success) {
      router.refresh();
    } else {
      setError(result.error || 'Không thể rút hồ sơ');
    }
  }

  if (!showConfirm) {
    return (
      <button onClick={() => setShowConfirm(true)} className="btn btn-secondary">
        Rút hồ sơ
      </button>
    );
  }

  return (
    <div className="card" style={{ padding: '16px', backgroundColor: '#fff3cd', border: '1px solid #ffc107' }}>
      <h4 style={{ margin: '0 0 8px 0', color: '#856404' }}>⚠️ Xác nhận rút hồ sơ</h4>
      <p style={{ margin: '0 0 12px 0', fontSize: '14px' }}>
        Bạn có chắc muốn rút hồ sơ ứng tuyển <strong>&quot;{jobTitle}&quot;</strong>? Bạn có thể ứng tuyển
        lại sau nếu muốn.
      </p>

      <div className="form-group" style={{ marginBottom: '12px' }}>
        <label htmlFor={`withdraw-note-${jobId}`}>Lý do rút hồ sơ (tuỳ chọn)</label>
        <textarea
          id={`withdraw-note-${jobId}`}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {error && (
        <div className="flash flash-error" style={{ marginBottom: '12px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={handleWithdraw} disabled={isWithdrawing} className="btn btn-danger" style={{ flex: 1 }}>
          {isWithdrawing ? 'Đang rút...' : 'Xác nhận rút hồ sơ'}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          disabled={isWithdrawing}
          className="btn btn-secondary"
          style={{ flex: 1 }}
        >
          Huỷ
        </button>
      </div>
    </div>
  );
}
