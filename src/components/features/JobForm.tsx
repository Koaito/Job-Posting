'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createJob, updateJob } from '@/app/actions/jobs';

/**
 * Reusable Job Form Component
 * Used for both create and edit modes
 * Matches Flask: templates/_job_form.html
 *
 * i18n (Giai đoạn 2, đợt "JobForm/CompanyForm", 09/2026): dịch label/
 * heading/nút bấm hiển thị qua `useTranslations`. KHÔNG đổi bất kỳ
 * `value` nào của `<option>`/enum — backend (schemas/jobs.py) chờ đúng
 * các chuỗi tiếng Việt/mã cố định hiện có (vd `province_name="Hà Nội"`,
 * `salary_type="NEGOTIABLE"`) nên chỉ dịch phần TEXT hiển thị, giữ
 * nguyên `value` gửi lên server — tương tự nguyên tắc đã áp dụng ở tầng
 * dịch `error_code` (Giai đoạn 3): không đổi dữ liệu, chỉ đổi hiển thị.
 */

interface JobFormProps {
  mode: 'create' | 'edit';
  initialData?: any;
}

export default function JobForm({ mode, initialData }: JobFormProps) {
  const router = useRouter();
  const t = useTranslations('jobForm');
  const tp = useTranslations('provinces');
  const tc = useTranslations('common');
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
      // BUG FIX (đợt dọn nợ 09/2026, đi cùng CompanyForm.tsx): 2 field
      // này tồn tại sẵn trong JobCreatePayload/JobUpdatePayload
      // (types/jobs.ts) và trong form _job_form.html gốc bên Flask,
      // nhưng form React trước đây bỏ sót hoàn toàn — job tạo/sửa qua
      // web luôn gửi work_type=null và salary_period mặc định "MONTH"
      // phía backend dù người dùng chọn khác trên UI (vì UI còn không
      // có ô để chọn). work_type "" (chưa chọn) gửi null, khớp hành vi
      // matching_industry/level_code/province_name ở trên.
      work_type: (formData.get('work_type') as string) || null,
      salary_period: (formData.get('salary_period') as string) || 'MONTH',
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

      {error && (
        // BUG FIX (đợt dọn nợ 09/2026): "alert alert-error" không tồn
        // tại trong public/css/ — không style, lỗi hiện ra "chìm" hoàn
        // toàn không ai nhìn thấy. "flash flash-error" mới là class
        // thật có style (đã dùng đúng ở CompanyForm.tsx từ đợt trước).
        <div className="flash flash-error">
          {error}
        </div>
      )}

      {/* BUG FIX (audit CSS 09/2026): trước đây mỗi field bọc trong
          <div class="form-field[ form-field-full]"> rồi mới tới <label>
          bên trong — 2 class đó không tồn tại, và quan trọng hơn: CSS
          thật định nghĩa ".form-grid > label.span-N" (public/css/
          07-forms.css) — tức LABEL phải là con trực tiếp của
          .form-grid thì mới nhận layout lưới 4 cột + độ rộng span-N.
          Bọc thêm div ở giữa khiến toàn bộ input rơi về layout mặc định
          (xếp dọc từng dòng), không phải grid 4 cột như thiết kế. Viết
          lại: label chính là grid item, class="required" (ảo) bỏ hẳn —
          Flask gốc chỉ ghi dấu "*" ngay trong text label, không cần
          class riêng gì cho dấu sao. */}
      <div className="form-grid">
        <label className="span-2" htmlFor="job_title">
          {t('jobTitleLabel')}
          <input
            type="text"
            id="job_title"
            name="job_title"
            required
            defaultValue={initialData?.job_title}
            placeholder={t('jobTitlePlaceholder')}
          />
        </label>

        {/* Company ID - TODO: Replace with autocomplete (Flask gốc dùng
            _company_combobox.html — chưa làm ở Next.js, giữ input text
            đơn giản, chỉ sửa cấu trúc/class cho đúng thật). */}
        <label className="span-2" htmlFor="company_id">
          {t('companyIdLabel')}
          <input
            type="text"
            id="company_id"
            name="company_id"
            required
            defaultValue={initialData?.company_id}
            placeholder={t('companyIdPlaceholder')}
          />
          <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 400 }}>
            {t('companyIdHint')}
          </span>
        </label>

        <label className="span-2" htmlFor="matching_industry">
          {t('industryLabel')}
          <select
            id="matching_industry"
            name="matching_industry"
            defaultValue={initialData?.matching_industry || ''}
          >
            <option value="">{t('selectIndustryOption')}</option>
            {/* value giữ nguyên tiếng Việt — khớp đúng chuỗi backend
                lưu/lọc theo matching_industry, chỉ TEXT hiển thị được dịch */}
            <option value="CNTT - Phần mềm">{t('industryIt')}</option>
            <option value="Marketing - PR">{t('industryMarketing')}</option>
            <option value="Kinh doanh - Bán hàng">{t('industrySales')}</option>
            <option value="Thiết kế - Mỹ thuật">{t('industryDesign')}</option>
            <option value="Khác">{t('industryOther')}</option>
          </select>
        </label>

        {/* Level - TODO: Load from backend /enums. Value là tiếng Anh
            sẵn (Intern/Fresher/...), khớp đúng backend — không cần dịch
            text lẫn value cho nhóm này. */}
        <label className="span-1" htmlFor="level_code">
          {t('levelLabel')}
          <select
            id="level_code"
            name="level_code"
            defaultValue={initialData?.level_code || ''}
          >
            <option value="">{t('selectLevelOption')}</option>
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
        </label>

        {/* Province - TODO: Load from backend. Namespace "provinces"
            dùng chung với CompanyForm.tsx (xem comment ở đó) — value
            giữ nguyên tiếng Việt có dấu, khớp province_name backend lưu
            trực tiếp, chỉ dịch TEXT hiển thị. */}
        <label className="span-1" htmlFor="province_name">
          {t('locationLabel')}
          <select
            id="province_name"
            name="province_name"
            defaultValue={initialData?.province_name || ''}
          >
            <option value="">{tp('selectPlaceholder')}</option>
            {/* BUG FIX: backend nhận province_name dạng chuỗi tên tỉnh,
                KHÔNG phải province_id số */}
            <option value="Hà Nội">{tp('hanoi')}</option>
            <option value="Hồ Chí Minh">{tp('hcm')}</option>
            <option value="Đà Nẵng">{tp('danang')}</option>
          </select>
        </label>

        {/* Work Type — khớp _job_form.html gốc (work_types), trước đây
            bị bỏ sót hoàn toàn khỏi form React. Value là mã enum
            backend chờ (work_type_enum), nhãn hiển thị dịch theo
            locale, khớp WORK_TYPE_MAP bên Flask (crawler_client/jobs.py)
            cho bản tiếng Việt. */}
        <label className="span-1" htmlFor="work_type">
          {t('workTypeLabel')}
          <select
            id="work_type"
            name="work_type"
            defaultValue={initialData?.work_type || ''}
          >
            <option value="">{t('selectWorkTypeOption')}</option>
            <option value="FULL_TIME">{t('workTypeFullTime')}</option>
            <option value="PART_TIME">{t('workTypePartTime')}</option>
            <option value="INTERNSHIP">{t('workTypeInternship')}</option>
            <option value="OTHER">{t('workTypeOther')}</option>
          </select>
        </label>

        <label className="span-1" htmlFor="salary_type">
          {t('salaryTypeLabel')}
          <select
            id="salary_type"
            name="salary_type"
            defaultValue={initialData?.salary_type || 'NEGOTIABLE'}
          >
            <option value="RANGE">{t('salaryTypeRange')}</option>
            <option value="EXACT">{t('salaryTypeExact')}</option>
            <option value="UPTO">{t('salaryTypeUpto')}</option>
            <option value="STARTING_FROM">{t('salaryTypeStartingFrom')}</option>
            <option value="NEGOTIABLE">{t('salaryTypeNegotiable')}</option>
            {/* BUG FIX (đợt dọn nợ 09/2026): SALARY_TYPE_MAP bên Flask
                gốc có 6 giá trị, form React trước đây chỉ có 5 — thiếu
                UNPAID (job không lương, vd thực tập không hỗ trợ) nên
                job loại này không tạo/sửa được đúng qua web. */}
            <option value="UNPAID">{t('salaryTypeUnpaid')}</option>
          </select>
        </label>

        {/* Salary Period — mới 08/2026 bên Flask (salary_period), form
            React trước đây chưa có ô này -> mọi job nhập lương NĂM qua
            web bị backend mặc định hiểu nhầm thành lương/tháng (sai
            lệch 12 lần, xem migration_add_salary_period.sql). */}
        <label className="span-1" htmlFor="salary_period">
          {t('salaryPeriodLabel')}
          <select
            id="salary_period"
            name="salary_period"
            defaultValue={initialData?.salary_period || 'MONTH'}
          >
            <option value="MONTH">{t('salaryPeriodMonth')}</option>
            <option value="YEAR">{t('salaryPeriodYear')}</option>
          </select>
        </label>

        <label className="span-1" htmlFor="salary_min">
          {t('salaryMinLabel')}
          <input
            type="number"
            id="salary_min"
            name="salary_min"
            defaultValue={initialData?.salary_min}
            placeholder="10000000"
          />
        </label>

        <label className="span-1" htmlFor="salary_max">
          {t('salaryMaxLabel')}
          <input
            type="number"
            id="salary_max"
            name="salary_max"
            defaultValue={initialData?.salary_max}
            placeholder="20000000"
          />
        </label>

        <label className="span-1" htmlFor="currency">
          {t('currencyLabel')}
          <select
            id="currency"
            name="currency"
            defaultValue={initialData?.currency || 'VNĐ'}
          >
            <option value="VNĐ">VNĐ</option>
            <option value="USD">USD</option>
          </select>
        </label>

        <label className="span-1" htmlFor="deadline">
          {t('deadlineLabel')}
          <input
            type="date"
            id="deadline"
            name="deadline"
            defaultValue={initialData?.deadline}
          />
        </label>

        {mode === 'edit' && (
          <label className="span-1" htmlFor="job_status">
            {t('statusLabel')}
            <select
              id="job_status"
              name="job_status"
              defaultValue={initialData?.job_status || 'OPEN'}
            >
              <option value="OPEN">{t('statusOpen')}</option>
              <option value="CLOSED">{t('statusClosed')}</option>
            </select>
          </label>
        )}

        {mode === 'edit' && (
          <label className="span-4" htmlFor="ss_team_notes">
            {t('internalNotesLabel')}
            <textarea
              id="ss_team_notes"
              name="ss_team_notes"
              rows={4}
              defaultValue={initialData?.ss_team_notes}
              placeholder={t('internalNotesPlaceholder')}
            />
          </label>
        )}
      </div>

      <div className="form-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? tc('saving') : (mode === 'create' ? t('submitCreate') : tc('update'))}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          {tc('cancel')}
        </button>
      </div>
    </form>
  );
}
