'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { unsaveJob } from '@/app/actions/me';

/**
 * Nút "Bỏ lưu" dùng ở trang /saved-jobs. Thêm 09/2026 (Phase 3.6). Không
 * cần confirm dialog như xoá job/rút hồ sơ — bỏ lưu là hành động nhẹ,
 * lưu lại được ngay từ trang chi tiết job nếu bấm nhầm.
 */

interface UnsaveJobButtonProps {
  jobId: string;
}

export default function UnsaveJobButton({ jobId }: UnsaveJobButtonProps) {
  const router = useRouter();
  const [isUnsaving, setIsUnsaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUnsave() {
    setIsUnsaving(true);
    setError(null);
    const result = await unsaveJob(jobId);
    setIsUnsaving(false);

    if (result.success) {
      router.refresh();
    } else {
      setError(result.error || 'Không thể bỏ lưu job này');
    }
  }

  return (
    <div>
      <button onClick={handleUnsave} disabled={isUnsaving} className="btn btn-secondary">
        {isUnsaving ? 'Đang xử lý...' : 'Bỏ lưu'}
      </button>
      {error && <div className="flash flash-error" style={{ marginTop: '8px' }}>{error}</div>}
    </div>
  );
}
