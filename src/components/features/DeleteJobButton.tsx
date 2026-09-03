'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteJob } from '@/app/actions/jobs';

/**
 * Delete Job Button with Confirmation Dialog
 * Soft deletes job by setting status to CLOSED
 */

interface DeleteJobButtonProps {
  jobId: string;
  jobTitle: string;
}

export default function DeleteJobButton({ jobId, jobTitle }: DeleteJobButtonProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    const result = await deleteJob(jobId);

    if (result.success) {
      // Redirect to jobs list after successful delete
      router.push('/jobs?deleted=1');
    } else {
      setError(result.error || 'Không thể xóa job');
      setIsDeleting(false);
    }
  };

  if (!showConfirm) {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        className="btn btn-block btn-danger"
      >
        🗑️ Xóa Job
      </button>
    );
  }

  return (
    <div className="card" style={{ padding: '16px', backgroundColor: '#fff3cd', border: '1px solid #ffc107' }}>
      <h4 style={{ margin: '0 0 8px 0', color: '#856404' }}>⚠️ Xác nhận xóa</h4>
      <p style={{ margin: '0 0 16px 0', fontSize: '14px' }}>
        Bạn có chắc muốn xóa job <strong>"{jobTitle}"</strong>?
        <br />
        Job sẽ bị đóng (status = CLOSED).
      </p>

      {error && (
        // BUG FIX (đợt dọn nợ 09/2026): "alert alert-error" không tồn
        // tại trong public/css/ — đổi sang "flash flash-error" (class
        // thật có style, cùng đợt sửa với JobForm.tsx).
        <div className="flash flash-error" style={{ marginBottom: '12px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="btn btn-danger"
          style={{ flex: 1 }}
        >
          {isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          disabled={isDeleting}
          className="btn btn-secondary"
          style={{ flex: 1 }}
        >
          Hủy
        </button>
      </div>
    </div>
  );
}
