import Link from 'next/link';
import CompanyForm from '@/components/features/CompanyForm';

/**
 * Company Create Page
 * Corresponds to Flask: templates/add_company.html (create mode)
 * Route: /companies/new
 */
export default function CompanyNewPage() {
  return (
    // CHUYỂN 09/2026 (audit CSS): bỏ div "page-container"/"form-container"
    // ngoài cùng — class ảo, main.content đã lo container rồi.
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">
            <Link href="/companies">← Quay lại danh sách</Link>
          </span>
          <h1>Thêm công ty mới</h1>
          <p className="lede">Tạo hồ sơ công ty mới trong database</p>
        </div>
      </div>

      <CompanyForm mode="create" />
    </>
  );
}
