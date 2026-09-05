'use client';

import { useRouter } from 'next/navigation';
import { withdrawApplication } from '@/app/actions/me';
import ConfirmActionButton from './ConfirmActionButton';

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

  return (
    <ConfirmActionButton
      triggerLabel="Rút hồ sơ"
      triggerClassName="btn btn-ghost btn-block"
      confirmTitle="⚠️ Xác nhận rút hồ sơ"
      confirmMessage={
        <>
          Bạn có chắc muốn rút hồ sơ ứng tuyển <strong>&quot;{jobTitle}&quot;</strong>? Bạn có thể ứng tuyển
          lại sau nếu muốn.
        </>
      }
      showNote
      noteLabel="Lý do rút hồ sơ (tuỳ chọn)"
      confirmButtonLabel="Xác nhận rút hồ sơ"
      confirmButtonLoadingLabel="Đang rút..."
      cancelButtonLabel="Huỷ"
      defaultErrorMessage="Không thể rút hồ sơ"
      onConfirm={(note) => withdrawApplication(jobId, note)}
      onSuccess={() => router.refresh()}
    />
  );
}
