'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createJob, updateJob } from '@/app/actions/jobs';

/**
 * Reusable Job Form Component
 * Used for both create and edit modes
 * Matches Flask: templates/job_form.html
 */

interface JobFormProps {
  mode: 'create' | 'edit';
  initialData?: any;
}

export default function JobForm({ mode, initialData }: JobFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    // BUG FIX: backend JobCreate/JobUpdate (schemas/jobs.py) dùng
    // extra="forbid" — gửi field lạ (level_id/province_id kiểu số) sẽ bị
    // 422 ngay lập tức. Schema thật chỉ nhận level_code/province_name
    // (chuỗi text), KHÔNG có field *_id nào cho 2 mục này.
    //
    // BUG FIX (audit 09/2026, phần "dọn type debt"): createJob/updateJob
    // giờ nhận JobCreatePayload/JobUpdatePayload (kiểu chặt, xem
    // actions/jobs.ts) thay vì "data: any" như trước — FormData.get() trả
    // về FormDataEntryValue | null (có thể là File), phải ép rõ về
    // string trước khi gửi, không để lọt kiểu File/null vào field mà
    // backend chờ string.
    const basePayload = {
      job_title: String(formData.get('job_title') || ''),
      company_id: String(formData.get('company_id') || ''),
      matching_industry: (formData.get('matching_industry') as string) || null,
      level_code: (formData.get('level_code') as string) || null,
      province_name: (formData.get('province_name') as string) || null,
      salary_min: formData.get('salary_min') ? parseInt(formData.get('salary_min') as string) : null,
      salary_max: formData.get('salary_max') ? parseInt(formData.get('salary_max') as string) : null,
      salary_type: (formData.get('salary_type') as string) || 'NEGOTIABLE',
      currency: (formData.get('currency') as string) || 'VNĐ',
      deadline: (formData.get('deadline') as string) || null,
    };

    try {
      let result;
      if (mode === 'create') {
        // BUG FIX: JobCreate KHÔNG có field job_status/ss_team_notes —
        // gửi 2 field này khi tạo mới cũng bị 422 (extra="forbid").
        result = await createJob(basePayload);
      } else {
        // JobUpdate CÓ job_status/ss_team_notes — chỉ hợp lệ khi sửa.
        result = await updateJob(initialData.job_id, {
          ...basePayload,
          job_status: (formData.get('job_status') as string) || 'OPEN',
          ss_team_notes: (formData.get('ss_team_notes') as string) || null,
        });
      }

      if (result.success && result.job) {
        router.push(`/jobs/${result.job.job_id}`);
      } else {
        setError(result.error || 'Có lỗi xảy ra');
      }
    } catch (err) {
      setError('Không thể kết nối với server');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card form-card">
      <h3>{mode === 'create' ? 'Thông tin Job mới' : 'Sửa thông tin Job'}</h3>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      <div className="form-grid">
        {/* Job Title */}
        <div className="form-field form-field-full">
          <label htmlFor="job_title">
            Tên Job <span className="required">*</span>
          </label>
          <input
            type="text"
            id="job_title"
            name="job_title"
            required
            defaultValue={initialData?.job_title}
            placeholder="VD: Frontend Developer"
          />
        </div>

        {/* Company ID - TODO: Replace with autocomplete */}
        <div className="form-field">
          <label htmlFor="company_id">
            Company ID <span className="required">*</span>
          </label>
          <input
            type="text"
            id="company_id"
            name="company_id"
            required
            defaultValue={initialData?.company_id}
            placeholder="UUID của công ty"
          />
          <p className="form-hint">
            TODO: Thay bằng autocomplete selector
          </p>
        </div>

        {/* Industry */}
        <div className="form-field">
          <label htmlFor="matching_industry">Ngành</label>
          <select
            id="matching_industry"
            name="matching_industry"
            defaultValue={initialData?.matching_industry || ''}
          >
            <option value="">-- Chọn ngành --</option>
            <option value="CNTT - Phần mềm">CNTT - Phần mềm</option>
            <option value="Marketing - PR">Marketing - PR</option>
            <option value="Kinh doanh - Bán hàng">Kinh doanh - Bán hàng</option>
            <option value="Thiết kế - Mỹ thuật">Thiết kế - Mỹ thuật</option>
            <option value="Khác">Khác</option>
          </select>
        </div>

        {/* Level - TODO: Load from backend /enums */}
        <div className="form-field">
          <label htmlFor="level_code">Level</label>
          <select
            id="level_code"
            name="level_code"
            defaultValue={initialData?.level_code || ''}
          >
            <option value="">-- Chọn level --</option>
            {/* BUG FIX: backend JobCreate/JobUpdate chỉ nhận level_code
                dạng chuỗi (Intern|Fresher|Junior|Middle|Senior|Lead|Manager),
                KHÔNG phải id số — value phải khớp đúng chuỗi backend mong đợi */}
            <option value="Intern">Intern</option>
            <option value="Fresher">Fresher</option>
            <option value="Junior">Junior</option>
            <option value="Middle">Middle</option>
            <option value="Senior">Senior</option>
            <option value="Lead">Lead</option>
            <option value="Manager">Manager</option>
          </select>
        </div>

        {/* Province - TODO: Load from backend */}
        <div className="form-field">
          <label htmlFor="province_name">Địa điểm</label>
          <select
            id="province_name"
            name="province_name"
            defaultValue={initialData?.province_name || ''}
          >
            <option value="">-- Chọn tỉnh/thành --</option>
            {/* BUG FIX: backend nhận province_name dạng chuỗi tên tỉnh,
                KHÔNG phải province_id số */}
            <option value="Hà Nội">Hà Nội</option>
            <option value="Hồ Chí Minh">Hồ Chí Minh</option>
            <option value="Đà Nẵng">Đà Nẵng</option>
          </select>
        </div>

        {/* Salary Min */}
        <div className="form-field">
          <label htmlFor="salary_min">Lương tối thiểu (VNĐ)</label>
          <input
            type="number"
            id="salary_min"
            name="salary_min"
            defaultValue={initialData?.salary_min}
            placeholder="10000000"
          />
        </div>

        {/* Salary Max */}
        <div className="form-field">
          <label htmlFor="salary_max">Lương tối đa (VNĐ)</label>
          <input
            type="number"
            id="salary_max"
            name="salary_max"
            defaultValue={initialData?.salary_max}
            placeholder="20000000"
          />
        </div>

        {/* Salary Type */}
        <div className="form-field">
          <label htmlFor="salary_type">Loại lương</label>
          <select
            id="salary_type"
            name="salary_type"
            defaultValue={initialData?.salary_type || 'NEGOTIABLE'}
          >
            <option value="RANGE">Khoảng</option>
            <option value="EXACT">Cố định</option>
            <option value="UPTO">Lên tới</option>
            <option value="STARTING_FROM">Từ</option>
            <option value="NEGOTIABLE">Thỏa thuận</option>
          </select>
        </div>

        {/* Currency */}
        <div className="form-field">
          <label htmlFor="currency">Tiền tệ</label>
          <select
            id="currency"
            name="currency"
            defaultValue={initialData?.currency || 'VNĐ'}
          >
            <option value="VNĐ">VNĐ</option>
            <option value="USD">USD</option>
          </select>
        </div>

        {/* Deadline */}
        <div className="form-field">
          <label htmlFor="deadline">Hạn nộp</label>
          <input
            type="date"
            id="deadline"
            name="deadline"
            defaultValue={initialData?.deadline}
          />
        </div>

        {/* Status */}
        <div className="form-field">
          <label htmlFor="job_status">Trạng thái</label>
          <select
            id="job_status"
            name="job_status"
            defaultValue={initialData?.job_status || 'OPEN'}
          >
            <option value="OPEN">Đang tuyển</option>
            <option value="CLOSED">Đã đóng</option>
          </select>
        </div>

        {/* Notes */}
        <div className="form-field form-field-full">
          <label htmlFor="ss_team_notes">Ghi chú nội bộ</label>
          <textarea
            id="ss_team_notes"
            name="ss_team_notes"
            rows={4}
            defaultValue={initialData?.ss_team_notes}
            placeholder="Ghi chú cho team SS..."
          />
        </div>
      </div>

      <div className="form-actions">
        <button 
          type="submit" 
          className="btn btn-primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Đang lưu...' : (mode === 'create' ? 'Tạo Job' : 'Cập nhật')}
        </button>
        <button 
          type="button" 
          className="btn btn-secondary"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Hủy
        </button>
      </div>
    </form>
  );
}
