'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { unsaveJob } from '@/app/actions/me';

/**
 * Nút "Bỏ lưu" dùng ở trang /saved-jobs. Thêm 09/2026 (Phase 3.6). Không
 * cần confirm dialog như xoá job/rút hồ sơ — bỏ lưu là hành động nhẹ,
 * lưu lại được ngay từ trang chi tiết job nếu bấm nhầm.
 *
 * i18n (Giai đoạn 2, nhóm 5, 09/2026): dịch qua
 * useTranslations('unsaveJobButton').
 */

interface UnsaveJobButtonProps {
  jobId: string;
}

export default function UnsaveJobButton({ jobId }: UnsaveJobButtonProps) {
  const router = useRouter();
  const t = useTranslations('unsaveJobButton');
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
      setError(result.error || t('errorDefault'));
    }
  }

  return (
    <div>
      <button onClick={handleUnsave} disabled={isUnsaving} className="save-btn saved">
        {isUnsaving ? t('processing') : t('unsave')}
      </button>
      {error && <div className="flash flash-error" style={{ marginTop: '8px' }}>{error}</div>}
    </div>
  );
}
