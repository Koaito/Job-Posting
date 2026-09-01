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
    const data = {
      job_title: formData.get('job_title'),
      company_id: formData.get('company_id'),
      matching_industry: formData.get('matching_industry') || null,
      level_id: formData.get('level_id') ? parseInt(formData.get('level_id') as string) : null,
      province_id: formData.get('province_id') ? parseInt(formData.get('province_id') as string) : null,
      salary_min: formData.get('salary_min') ? parseInt(formData.get('salary_min') as string) : null,
      salary_max: formData.get('salary_max') ? parseInt(formData.get('salary_max') as string) : null,
      salary_type: formData.get('salary_type') || 'NEGOTIABLE',
      currency: formData.get('currency') || 'VNĐ',
      deadline: formData.get('deadline') || null,
      job_status: formData.get('job_status') || 'OPEN',
      ss_team_notes: formData.get('ss_team_notes') || null,
    };

    try {
      const result = mode === 'create' 
        ? await createJob(data)
        : await updateJob(initialData.id, data);
      
      if (result.success && result.job) {
        router.push(`/jobs/${result.job.id}`);
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
          <label htmlFor="level_id">Level</label>
          <select
            id="level_id"
            name="level_id"
            defaultValue={initialData?.level_id || ''}
          >
            <option value="">-- Chọn level --</option>
            <option value="1">Intern</option>
            <option value="2">Fresher</option>
            <option value="3">Junior</option>
            <option value="4">Middle</option>
            <option value="5">Senior</option>
          </select>
        </div>

        {/* Province - TODO: Load from backend */}
        <div className="form-field">
          <label htmlFor="province_id">Địa điểm</label>
          <select
            id="province_id"
            name="province_id"
            defaultValue={initialData?.province_id || ''}
          >
            <option value="">-- Chọn tỉnh/thành --</option>
            <option value="12">Hà Nội</option>
            <option value="29">Hồ Chí Minh</option>
            <option value="21">Đà Nẵng</option>
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
