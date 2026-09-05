'use client';

import { useRouter } from 'next/navigation';
import { deleteCompany } from '@/app/actions/companies';
import ConfirmActionButton from './ConfirmActionButton';

/**
 * Delete Company Button — xoá MỀM (is_active=false), note BẮT BUỘC.
 * Corresponds to Flask: templates/company_detail.html (khối <details>
 * "Xoá công ty này").
 *
 * Khác DeleteJobButton.tsx (chỉ cần bấm xác nhận): backend
 * CompanyDeleteRequest.note là field bắt buộc (thiếu -> 422) — nút này
 * PHẢI có ô nhập lý do, không thể chỉ confirm() suông.
 */
interface DeleteCompanyButtonProps {
  companyId: string;
  companyName: string;
}

export default function DeleteCompanyButton({ companyId, companyName }: DeleteCompanyButtonProps) {
  const router = useRouter();

  return (
    <ConfirmActionButton
      triggerLabel="🗑️ Xoá công ty"
      confirmTitle="⚠️ Xác nhận xoá"
      confirmMessage={
        <>
          Xoá công ty <strong>&quot;{companyName}&quot;</strong>? Đây là xoá mềm — JD liên quan vẫn
          giữ nguyên, có thể xem lại qua Lịch sử thao tác.
        </>
      }
      showNote
      requireNote
      noteLabel=""
      notePlaceholder="Lý do xoá công ty này — bắt buộc..."
      noteRequiredError="Vui lòng nhập lý do xoá."
      confirmButtonLabel="Xác nhận xoá"
      confirmButtonLoadingLabel="Đang xoá..."
      defaultErrorMessage="Không thể xoá công ty"
      onConfirm={(note) => deleteCompany(companyId, { note: note ?? '' })}
      onSuccess={() => router.push('/companies?deleted=1')}
    />
  );
}
