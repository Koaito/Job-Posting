'use client';

import { useRouter } from 'next/navigation';
import { deleteJob } from '@/app/actions/jobs';
import ConfirmActionButton from './ConfirmActionButton';

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

  return (
    <ConfirmActionButton
      triggerLabel="🗑️ Xóa Job"
      confirmTitle="⚠️ Xác nhận xóa"
      confirmMessage={
        <>
          Bạn có chắc muốn xóa job <strong>&quot;{jobTitle}&quot;</strong>?
          <br />
          Job sẽ bị đóng (status = CLOSED).
        </>
      }
      confirmButtonLabel="Xác nhận xóa"
      confirmButtonLoadingLabel="Đang xóa..."
      defaultErrorMessage="Không thể xóa job"
      onConfirm={() => deleteJob(jobId)}
      onSuccess={() => router.push('/jobs?deleted=1')}
    />
  );
}
