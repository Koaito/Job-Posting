import Link from 'next/link';
import JobForm from '@/components/features/JobForm';

/**
 * Job Create Page
 * Corresponds to Flask: templates/job_form.html (create mode)
 * Route: /jobs/new
 */

export default function JobNewPage() {
  return (
    // CHUYỂN 09/2026 (audit CSS): bỏ div "page-container" ngoài cùng và
    // "form-container" bọc JobForm — cả 2 đều là class ảo, không tồn
    // tại trong CSS nào. main.content (root layout.tsx) đã lo container
    // rồi, JobForm tự có "card form-card" của chính nó.
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">
            <Link href="/jobs">← Quay lại danh sách</Link>
          </span>
          <h1>Thêm Job Mới</h1>
          <p className="lede">Tạo job posting mới trong database</p>
        </div>
      </div>

      <JobForm mode="create" />
    </>
  );
}
