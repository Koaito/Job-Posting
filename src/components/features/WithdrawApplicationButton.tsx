'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { withdrawApplication } from '@/app/actions/me';
import ConfirmActionButton from './ConfirmActionButton';

/**
 * Nút "Rút hồ sơ" dùng ở trang /my-applications — kèm modal nhập lý do
 * (note, tuỳ chọn), cùng pattern xác nhận với DeleteJobButton.tsx. Thêm
 * 09/2026 (Phase 3.6).
 *
 * i18n (Giai đoạn 2, nhóm 5, 09/2026): dịch label/tiêu đề/nút bấm qua
 * `useTranslations('confirmButtons')`, namespace `withdrawApplication`.
 * Không đổi hành vi/logic, chỉ đổi hiển thị theo locale.
 */

interface WithdrawApplicationButtonProps {
  jobId: string;
  jobTitle: string;
}

export default function WithdrawApplicationButton({ jobId, jobTitle }: WithdrawApplicationButtonProps) {
  const router = useRouter();
  const t = useTranslations('confirmButtons.withdrawApplication');

  return (
    <ConfirmActionButton
      triggerLabel={t('triggerLabel')}
      triggerClassName="btn btn-ghost btn-block"
      confirmTitle={t('confirmTitle')}
      confirmMessage={
        <>
          {t('confirmMessagePrefix')} <strong>&quot;{jobTitle}&quot;</strong>
          {t('confirmMessageSuffix')}
        </>
      }
      showNote
      noteLabel={t('noteLabel')}
      confirmButtonLabel={t('confirmButtonLabel')}
      confirmButtonLoadingLabel={t('confirmButtonLoadingLabel')}
      cancelButtonLabel={t('cancelButtonLabel')}
      defaultErrorMessage={t('defaultErrorMessage')}
      onConfirm={(note) => withdrawApplication(jobId, note)}
      onSuccess={() => router.refresh()}
    />
  );
}
