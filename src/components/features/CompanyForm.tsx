'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createCompany, updateCompany } from '@/app/actions/companies';
import { PARTNERSHIP_POTENTIAL_OPTIONS } from '@/lib/companies/potential';
import type { CompanyDetail } from '@/types/companies';

/**
 * Reusable Company Form Component — 2 mode create/edit.
 * Corresponds to Flask: templates/add_company.html
 *
 * BUG FIX (tương tự đã sửa ở JobForm.tsx — audit 09/2026): backend
 * CompanyCreate/CompanyUpdate (schemas/companies.py) dùng
 * extra="forbid" — gửi field lạ sẽ bị 422 ngay. Chỉ map đúng field 2
 * schema này khai, ép rõ FormDataEntryValue -> string trước khi gửi.
 *
 * Danh sách tỉnh/thành dưới đây CHỈ có 3 lựa chọn, cố tình giữ NGUYÊN
 * đúng 3 giá trị JobForm.tsx đang dùng (Hà Nội/Hồ Chí Minh/Đà Nẵng) —
 * KHÔNG lấy lại danh sách 63 tỉnh của Flask gốc (constants.py::CITIES_VN,
 * dùng "TP. Hồ Chí Minh" có tiền tố "TP.") vì province_name là field
 * dùng chung giữa Job và Company — nếu 2 form ghi 2 chuỗi khác nhau cho
 * cùng 1 thành phố ("Hồ Chí Minh" vs "TP. Hồ Chí Minh") thì lọc theo
 * tỉnh sẽ không khớp chéo được giữa 2 trang. Việc mở rộng đủ 63
 * tỉnh/thành nên làm 1 lần cho cả 2 form, không phải việc riêng của
 * module Companies.
 *
 * i18n (Giai đoạn 2, đợt "JobForm/CompanyForm", 09/2026): dùng chung
 * namespace "provinces" với JobForm.tsx (đúng tinh thần đoạn comment
 * trên — 2 form phải hiển thị nhất quán) và namespace "common" cho nút
 * Hủy/Cập nhật/lỗi chung. Chỉ dịch TEXT hiển thị, giữ nguyên mọi
 * `value` gửi lên backend (xem comment tương tự ở JobForm.tsx).
 *
 * CHƯA dịch (để đợt sau, cố ý): nhãn PARTNERSHIP_POTENTIAL_OPTIONS
 * (lib/companies/potential.ts) — hàm partnershipPotentialClass() ở đó
 * tự suy ra tên class CSS TRỰC TIẾP từ label tiếng Việt (`.potential-Cao`,
 * xem docstring trong file đó), nên đổi label hiển thị theo locale mà
 * không tách riêng "label để hiển thị" khỏi "label để suy ra class" sẽ
 * làm vỡ style badge tiềm năng ở nơi khác đang dùng chung hàm này (vd
 * company card/list). Cần sửa `potential.ts` trước (decouple 2 việc
 * đó), không nên vá tạm trong lúc dịch JobForm/CompanyForm.
 */

const PROVINCE_OPTIONS = ['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng'] as const;

interface CompanyFormProps {
  mode: 'create' | 'edit';
  initialData?: CompanyDetail;
}

export default function CompanyForm({ mode, initialData }: CompanyFormProps) {
  const router = useRouter();
  const t = useTranslations('companyForm');
  const tp = useTranslations('provinces');
  const tc = useTranslations('common');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // value giữ nguyên tiếng Việt có dấu (khớp province_name backend lưu),
  // chỉ tra label hiển thị theo locale qua namespace "provinces".
  const PROVINCE_LABEL_KEY: Record<(typeof PROVINCE_OPTIONS)[number], 'hanoi' | 'hcm' | 'danang'> = {
    'Hà Nội': 'hanoi',
    'Hồ Chí Minh': 'hcm',
    'Đà Nẵng': 'danang',
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const basePayload = {
      company_name: String(formData.get('company_name') || ''),
      tax_id: (formData.get('tax_id') as string) || null,
      website: (formData.get('website') as string) || null,
      industry: (formData.get('industry') as string) || null,
      company_size: (formData.get('company_size') as string) || null,
      address: (formData.get('address') as string) || null,
      province_name: (formData.get('province_name') as string) || null,
      fanpage_url: (formData.get('fanpage_url') as string) || null,
      linkedin_url: (formData.get('linkedin_url') as string) || null,
      partnership_potential: (formData.get('partnership_potential') as string) || null,
    };

    try {
      let result;
      if (mode === 'create') {
        result = await createCompany(basePayload);
      } else {
        // CompanyUpdate có thêm "note" (tuỳ chọn) cho audit_logs — không
        // có ở CompanyCreate.
        result = await updateCompany(initialData!.company_id, {
          ...basePayload,
          note: (formData.get('note') as string) || undefined,
        });
      }

      if (result.success && result.company) {
        router.push(`/companies/${result.company.company_id}`);
      } else {
        setError(result.error || tc('genericError'));
      }
    } catch {
      setError(tc('networkError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card form-card">
      <h3>{mode === 'create' ? t('titleCreate') : t('titleEdit')}</h3>

      {error && <div className="flash flash-error">{error}</div>}

      {/* BUG FIX (audit CSS 09/2026, giống JobForm.tsx): bỏ div
          "form-field"/"form-field-full" (ảo) — CSS thật định nghĩa
          ".form-grid > label.span-N" (07-forms.css), label phải là con
          trực tiếp của .form-grid để nhận layout lưới 4 cột. Bỏ luôn
          span "required" (ảo) — Flask gốc chỉ ghi "*" ngay trong text
          label. */}
      <div className="form-grid">
        <label className="span-4" htmlFor="company_name">
          {t('nameLabel')}
          <input
            type="text"
            id="company_name"
            name="company_name"
            required
            defaultValue={initialData?.company_name}
            placeholder={t('namePlaceholder')}
          />
        </label>

        <label className="span-1" htmlFor="tax_id">
          {t('taxIdLabel')}
          <input type="text" id="tax_id" name="tax_id" defaultValue={initialData?.tax_id || ''} />
        </label>

        <label className="span-1" htmlFor="website">
          {t('websiteLabel')}
          <input
            type="url"
            id="website"
            name="website"
            defaultValue={initialData?.website || ''}
            placeholder="https://..."
          />
        </label>

        <label className="span-1" htmlFor="industry">
          {t('industryLabel')}
          <input
            type="text"
            id="industry"
            name="industry"
            defaultValue={initialData?.industry || ''}
            placeholder={t('industryPlaceholder')}
          />
        </label>

        <label className="span-1" htmlFor="company_size">
          {t('sizeLabel')}
          <input
            type="text"
            id="company_size"
            name="company_size"
            defaultValue={initialData?.company_size || ''}
            placeholder={t('sizePlaceholder')}
          />
        </label>

        <label className="span-2" htmlFor="province_name">
          {t('provinceLabel')}
          <select id="province_name" name="province_name" defaultValue={initialData?.province_name || ''}>
            <option value="">{tp('selectPlaceholder')}</option>
            {PROVINCE_OPTIONS.map((p) => (
              <option key={p} value={p}>{tp(PROVINCE_LABEL_KEY[p])}</option>
            ))}
          </select>
        </label>

        {/* PARTNERSHIP_POTENTIAL_OPTIONS: CHƯA dịch, xem comment đầu
            file — label ở đây vẫn tiếng Việt cố định cho cả 2 locale. */}
        <label className="span-2" htmlFor="partnership_potential">
          {t('potentialLabel')}
          <select
            id="partnership_potential"
            name="partnership_potential"
            defaultValue={initialData?.partnership_potential || 'UNVERIFIED'}
          >
            {PARTNERSHIP_POTENTIAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        <label className="span-4" htmlFor="address">
          {t('addressLabel')}
          <input type="text" id="address" name="address" defaultValue={initialData?.address || ''} />
        </label>

        <label className="span-2" htmlFor="fanpage_url">
          {t('fanpageLabel')}
          <input
            type="url"
            id="fanpage_url"
            name="fanpage_url"
            defaultValue={initialData?.fanpage_url || ''}
            placeholder="https://facebook.com/..."
          />
        </label>

        <label className="span-2" htmlFor="linkedin_url">
          {t('linkedinLabel')}
          <input
            type="url"
            id="linkedin_url"
            name="linkedin_url"
            defaultValue={initialData?.linkedin_url || ''}
            placeholder="https://linkedin.com/company/..."
          />
        </label>

        {mode === 'edit' && (
          <label className="span-4" htmlFor="note">
            {t('editNoteLabel')}
            <textarea id="note" name="note" rows={2} placeholder={t('editNotePlaceholder')} />
          </label>
        )}
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? tc('saving') : mode === 'create' ? t('submitCreate') : tc('update')}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => router.back()} disabled={isSubmitting}>
          {tc('cancel')}
        </button>
      </div>
    </form>
  );
}
