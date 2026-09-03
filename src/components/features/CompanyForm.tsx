'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
 */

const PROVINCE_OPTIONS = ['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng'];

interface CompanyFormProps {
  mode: 'create' | 'edit';
  initialData?: CompanyDetail;
}

export default function CompanyForm({ mode, initialData }: CompanyFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setError(result.error || 'Có lỗi xảy ra');
      }
    } catch {
      setError('Không thể kết nối với server');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card form-card">
      <h3>{mode === 'create' ? 'Thông tin công ty mới' : 'Sửa hồ sơ công ty'}</h3>

      {error && <div className="flash flash-error">{error}</div>}

      <div className="form-grid">
        <div className="form-field form-field-full">
          <label htmlFor="company_name">
            Tên công ty <span className="required">*</span>
          </label>
          <input
            type="text"
            id="company_name"
            name="company_name"
            required
            defaultValue={initialData?.company_name}
            placeholder="VD: Công ty TNHH ABC"
          />
        </div>

        <div className="form-field">
          <label htmlFor="tax_id">Mã số thuế</label>
          <input type="text" id="tax_id" name="tax_id" defaultValue={initialData?.tax_id || ''} />
        </div>

        <div className="form-field">
          <label htmlFor="website">Website</label>
          <input
            type="url"
            id="website"
            name="website"
            defaultValue={initialData?.website || ''}
            placeholder="https://..."
          />
        </div>

        <div className="form-field">
          <label htmlFor="industry">Lĩnh vực</label>
          <input
            type="text"
            id="industry"
            name="industry"
            defaultValue={initialData?.industry || ''}
            placeholder="VD: CNTT - Phần mềm"
          />
        </div>

        <div className="form-field">
          <label htmlFor="company_size">Quy mô</label>
          <input
            type="text"
            id="company_size"
            name="company_size"
            defaultValue={initialData?.company_size || ''}
            placeholder="VD: 50-200 nhân sự"
          />
        </div>

        <div className="form-field">
          <label htmlFor="province_name">Tỉnh/thành</label>
          <select id="province_name" name="province_name" defaultValue={initialData?.province_name || ''}>
            <option value="">-- Chọn tỉnh/thành --</option>
            {PROVINCE_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="partnership_potential">Tiềm năng hợp tác</label>
          <select
            id="partnership_potential"
            name="partnership_potential"
            defaultValue={initialData?.partnership_potential || 'UNVERIFIED'}
          >
            {PARTNERSHIP_POTENTIAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="form-field form-field-full">
          <label htmlFor="address">Địa chỉ</label>
          <input type="text" id="address" name="address" defaultValue={initialData?.address || ''} />
        </div>

        <div className="form-field">
          <label htmlFor="fanpage_url">Fanpage</label>
          <input
            type="url"
            id="fanpage_url"
            name="fanpage_url"
            defaultValue={initialData?.fanpage_url || ''}
            placeholder="https://facebook.com/..."
          />
        </div>

        <div className="form-field">
          <label htmlFor="linkedin_url">LinkedIn</label>
          <input
            type="url"
            id="linkedin_url"
            name="linkedin_url"
            defaultValue={initialData?.linkedin_url || ''}
            placeholder="https://linkedin.com/company/..."
          />
        </div>

        {mode === 'edit' && (
          <div className="form-field form-field-full">
            <label htmlFor="note">Ghi chú sửa đổi (cho lịch sử thao tác)</label>
            <textarea id="note" name="note" rows={2} placeholder="Không bắt buộc..." />
          </div>
        )}
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Đang lưu...' : mode === 'create' ? 'Tạo công ty' : 'Cập nhật'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => router.back()} disabled={isSubmitting}>
          Hủy
        </button>
      </div>
    </form>
  );
}
