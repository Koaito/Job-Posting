'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
 *
 * i18n (Giai đoạn 2, nhóm 5, 09/2026): dịch label/tiêu đề/nút bấm qua
 * `useTranslations('confirmButtons')`, namespace `deleteCompany`. Không
 * đổi hành vi/logic (vẫn showNote/requireNote), chỉ đổi hiển thị theo
 * locale.
 */
interface DeleteCompanyButtonProps {
  companyId: string;
  companyName: string;
}

export default function DeleteCompanyButton({ companyId, companyName }: DeleteCompanyButtonProps) {
  const router = useRouter();
  const t = useTranslations('confirmButtons.deleteCompany');

  return (
    <ConfirmActionButton
      triggerLabel={t('triggerLabel')}
      confirmTitle={t('confirmTitle')}
      confirmMessage={
        <>
          {t('confirmMessagePrefix')} <strong>&quot;{companyName}&quot;</strong>
          {t('confirmMessageSuffix')}
        </>
      }
      showNote
      requireNote
      noteLabel=""
      notePlaceholder={t('notePlaceholder')}
      noteRequiredError={t('noteRequiredError')}
      confirmButtonLabel={t('confirmButtonLabel')}
      confirmButtonLoadingLabel={t('confirmButtonLoadingLabel')}
      defaultErrorMessage={t('defaultErrorMessage')}
      onConfirm={(note) => deleteCompany(companyId, { note: note ?? '' })}
      onSuccess={() => router.push('/companies?deleted=1')}
    />
  );
}
