'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { updateCompany } from '@/app/actions/companies';
import { PARTNERSHIP_POTENTIAL_OPTIONS, partnershipPotentialClass, partnershipPotentialLabel } from '@/lib/companies/potential';

/**
 * "Sửa nhanh Tiềm năng" ngay tại bảng danh sách công ty (audit 09/2026 #16)
 * Corresponds to Flask: templates/companies.html (chip <details>/<summary>
 * + form ẩn submit lên companies.update_potential).
 *
 * Backend KHÔNG có route riêng cho việc đổi 1 field này — gọi thẳng
 * updateCompany(id, {partnership_potential}) (CompanyUpdate cho phép
 * gửi từng field lẻ, field nào không gửi giữ nguyên). KHÔNG bắt buộc
 * note (khác DeleteCompanyButton) — đúng hành vi backend, CompanyUpdate
 * .note chỉ optional.
 *
 * i18n (Giai đoạn 2, nhóm 5, 09/2026): dịch nút Lưu/lỗi qua
 * useTranslations('potentialQuickEdit') + dùng chung useTranslations
 * ('common').saving cho label lúc đang lưu. Nhãn từng option
 * (partnershipPotentialLabel) CỐ Ý CHƯA dịch — xem ghi chú ở
 * lib/companies/potential.ts (đụng chung class CSS suy từ label).
 */
interface PotentialQuickEditProps {
  companyId: string;
  value: string;
}

export default function PotentialQuickEdit({ companyId, value }: PotentialQuickEditProps) {
  const router = useRouter();
  const t = useTranslations('potentialQuickEdit');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const result = await updateCompany(companyId, { partnership_potential: selected });

    setSaving(false);

    if (result.success) {
      setOpen(false);
      router.refresh();
    } else {
      setError(result.error || t('errorDefault'));
    }
  };

  return (
    <details className="potential-edit" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="fit-chip-wrap" tabIndex={0}>
        <span className={`fit-chip ${partnershipPotentialClass(value)}`}>
          {partnershipPotentialLabel(value)}
        </span>
      </summary>
      <form onSubmit={handleSave} className="potential-edit-form">
        {error && <p style={{ color: '#B23A22', fontSize: '12px', margin: 0 }}>{error}</p>}
        <select value={selected} onChange={(e) => setSelected(e.target.value)} disabled={saving}>
          {PARTNERSHIP_POTENTIAL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button className="btn btn-text" type="submit" disabled={saving}>
          {saving ? tc('saving') : t('save')}
        </button>
      </form>
    </details>
  );
}
