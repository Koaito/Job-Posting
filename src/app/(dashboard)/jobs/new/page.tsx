import Link from 'next/link';
import JobForm from '@/components/features/JobForm';

/**
 * Job Create Page
 * Corresponds to Flask: templates/job_form.html (create mode)
 * Route: /jobs/new
 */

export default function JobNewPage() {
  return (
    <div className="page-container">
      <div className="page-head">
        <div>
          <span className="eyebrow">
            <Link href="/jobs">← Quay lại danh sách</Link>
          </span>
          <h1>Thêm Job Mới</h1>
          <p className="lede">Tạo job posting mới trong database</p>
        </div>
      </div>

      <div className="form-container">
        <JobForm mode="create" />
      </div>
    </div>
  );
}
