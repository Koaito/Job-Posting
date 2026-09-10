'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { unsaveJob } from '@/app/actions/me';
import { useToast } from '@/components/ui/toast/ToastProvider';

/**
 * Nút "Bỏ lưu" dùng ở trang /saved-jobs. Thêm 09/2026 (Phase 3.6). Không
 * cần confirm dialog như xoá job/rút hồ sơ — bỏ lưu là hành động nhẹ,
 * lưu lại được ngay từ trang chi tiết job nếu bấm nhầm.
 *
 * i18n (Giai đoạn 2, nhóm 5, 09/2026): dịch qua
 * useTranslations('unsaveJobButton').
 *
 * B.1 Polish (09/2026): đổi flash inline (`{error && <div
 * className="flash...">}`) sang `toast.error()` — đúng use case gốc
 * `showToast()` (public/app.js, Flask): hành động bấm-nút-xong-liền,
 * không reload trang, không cần lỗi ở lại persistent (khác lỗi validate
 * form, xem CompanyForm.tsx/JobForm.tsx — CỐ Ý giữ nguyên inline).
 */

interface UnsaveJobButtonProps {
  jobId: string;
}

export default function UnsaveJobButton({ jobId }: UnsaveJobButtonProps) {
  const router = useRouter();
  const t = useTranslations('unsaveJobButton');
  const toast = useToast();
  const [isUnsaving, setIsUnsaving] = useState(false);

  async function handleUnsave() {
    setIsUnsaving(true);
    const result = await unsaveJob(jobId);
    setIsUnsaving(false);

    if (result.success) {
      router.refresh();
    } else {
      toast.error(result.error || t('errorDefault'));
    }
  }

  return (
    <button onClick={handleUnsave} disabled={isUnsaving} className="save-btn saved">
      {isUnsaving ? t('processing') : t('unsave')}
    </button>
  );
}
