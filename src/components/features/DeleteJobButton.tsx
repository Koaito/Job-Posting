'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { deleteJob } from '@/app/actions/jobs';
import ConfirmActionButton from './ConfirmActionButton';

/**
 * Delete Job Button with Confirmation Dialog
 * Soft deletes job by setting status to CLOSED
 *
 * i18n (Giai đoạn 2, nhóm 5, 09/2026): dịch label/tiêu đề/nút bấm qua
 * `useTranslations('confirmButtons')`, namespace `deleteJob`. Không đổi
 * hành vi/logic, chỉ đổi hiển thị theo locale.
 */

interface DeleteJobButtonProps {
  jobId: string;
  jobTitle: string;
}

export default function DeleteJobButton({ jobId, jobTitle }: DeleteJobButtonProps) {
  const router = useRouter();
  const t = useTranslations('confirmButtons.deleteJob');

  return (
    <ConfirmActionButton
      triggerLabel={t('triggerLabel')}
      confirmTitle={t('confirmTitle')}
      confirmMessage={
        <>
          {t('confirmMessagePrefix')} <strong>&quot;{jobTitle}&quot;</strong>
          {t('confirmMessageSuffix')}
          <br />
          {t('confirmMessageNote')}
        </>
      }
      confirmButtonLabel={t('confirmButtonLabel')}
      confirmButtonLoadingLabel={t('confirmButtonLoadingLabel')}
      defaultErrorMessage={t('defaultErrorMessage')}
      onConfirm={() => deleteJob(jobId)}
      onSuccess={() => router.push('/jobs?deleted=1')}
    />
  );
}
