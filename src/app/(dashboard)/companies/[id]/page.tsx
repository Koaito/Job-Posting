import { getCompanyById } from '@/app/actions/companies';
import { getContactsByCompany } from '@/app/actions/contacts';
import { getCurrentUser } from '@/app/actions/auth';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import DeleteCompanyButton from '@/components/features/DeleteCompanyButton';
import CompanyContactsManager from '@/components/features/CompanyContactsManager';
import { isStaffRole } from '@/lib/auth/roles';
import { partnershipPotentialClass, partnershipPotentialLabel } from '@/lib/companies/potential';

/**
 * Company Detail Page
 * Corresponds to Flask: templates/company_detail.html
 * Route: /companies/[id]
 *
 * Mới 09/2026 — phần "Người liên hệ HR" giờ đã dựng (trước đây TODO
 * chờ actions/contacts.ts). Backend /companies/{id}/contacts yêu cầu
 * role 'ss_team' trở lên (khác GET /companies/{id} công khai cho mọi
 * role đã đăng nhập) — CHỈ gọi + hiện section này với staff, học viên
 * ('user') không thấy thông tin liên hệ HR (đúng thiết kế: dữ liệu
 * nhạy cảm, không phải lỗi ẩn nhầm).
 */
export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [company, currentUser] = await Promise.all([getCompanyById(id), getCurrentUser()]);

  if (!company) {
    notFound();
  }

  const isStaff = isStaffRole(currentUser?.role);
  const contacts = isStaff ? await getContactsByCompany(company.company_id) : [];

  return (
    // BUG FIX (audit CSS 09/2026): bỏ div "page-container" ngoài cùng —
    // class ảo, main.content (root layout.tsx) đã lo container rồi
    // (giống fix đã áp dụng ở jobs/[id]/page.tsx).
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">
            <Link href="/companies">← Danh sách công ty</Link>
          </span>
          <h1>{company.company_name}</h1>
          <p className="lede">
            {company.industry || 'Chưa rõ lĩnh vực'}
            {company.province_name && ` · ${company.province_name}`}
            {company.company_size && ` · ${company.company_size} nhân sự`}
          </p>
        </div>
        {/* Bỏ div "page-head-actions" bọc ngoài (class ảo) — .page-head
            vốn đã là flex space-between, nút chỉ cần là con trực tiếp. */}
        <Link href={`/companies/${company.company_id}/edit`} className="btn btn-primary">
          Sửa hồ sơ công ty
        </Link>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          <section className="card">
            <h4>Job đã đăng ({company.jobs?.length || 0})</h4>
            {company.jobs && company.jobs.length > 0 ? (
              <ul className="applicant-list">
                {company.jobs.map((job) => (
                  <li key={job.job_id}>
                    <Link href={`/jobs/${job.job_id}`}><strong>{job.job_title}</strong></Link>
                    <span className="muted">
                      {' '}
                      {job.level_code || '—'} · {job.province_name || '—'} ·{' '}
                      {job.job_status === 'OPEN' ? 'Đang tuyển' : 'Đã đóng'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Chưa có job nào của công ty này.</p>
            )}
            <Link href="/jobs/new" className="btn btn-ghost" style={{ marginTop: '8px' }}>
              + Thêm job cho công ty này
            </Link>
          </section>

          {isStaff && (
            <section className="card">
              <h4>Người liên hệ HR</h4>
              <CompanyContactsManager companyId={company.company_id} initialContacts={contacts} />
            </section>
          )}
        </div>

        {/* BUG FIX (audit CSS 09/2026): "detail-sidebar" không tồn tại,
            class thật là "detail-side" (public/css/06-detail-page.css,
            gồm cả position: sticky) — giống fix ở jobs/[id]/page.tsx. */}
        <aside className="detail-side">
          <section className="card">
            <h4>Thông tin chung</h4>
            {/* BUG FIX: "detail-list" không tồn tại — class thật cho
                khối dt/dd kiểu này là "kv" (public/css/06-detail-page.css,
                dùng chung với company_detail.html gốc). */}
            <dl className="kv">
              <dt>Tiềm năng</dt>
              <dd>
                <span className={`fit-chip ${partnershipPotentialClass(company.partnership_potential)}`}>
                  {partnershipPotentialLabel(company.partnership_potential)}
                </span>
              </dd>

              {company.tax_id && (
                <>
                  <dt>Mã số thuế</dt>
                  <dd>{company.tax_id}</dd>
                </>
              )}

              {company.address && (
                <>
                  <dt>Địa chỉ</dt>
                  <dd>{company.address}</dd>
                </>
              )}

              {/* Bỏ class "link" (ảo) ở 3 thẻ <a> dưới đây — "kv dd a"
                  (public/css/06-detail-page.css) đã tự tô màu accent cho
                  mọi link trong danh sách này rồi, giống fix ở
                  jobs/[id]/page.tsx. */}
              {company.website && (
                <>
                  <dt>Website</dt>
                  <dd>
                    <a href={company.website} target="_blank" rel="noopener noreferrer">
                      {company.website}
                    </a>
                  </dd>
                </>
              )}

              {company.fanpage_url && (
                <>
                  <dt>Fanpage</dt>
                  <dd>
                    <a href={company.fanpage_url} target="_blank" rel="noopener noreferrer">
                      Xem fanpage ↗
                    </a>
                  </dd>
                </>
              )}

              {company.linkedin_url && (
                <>
                  <dt>LinkedIn</dt>
                  <dd>
                    <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer">
                      Xem LinkedIn ↗
                    </a>
                  </dd>
                </>
              )}
            </dl>
          </section>

          <section className="card">
            <h4>Thông tin hệ thống</h4>
            {/* "detail-list" → "kv" (như trên). Bỏ luôn "font-mono" ở
                dd ID — không phải class thật (--font-mono chỉ là CSS
                variable dùng bên trong các selector khác như .skill-tag,
                không có sẵn dạng utility class đứng riêng); job/[id]/page.tsx
                (đã fix) cũng hiện ID dạng <dd> thường, không gắn class gì. */}
            <dl className="kv">
              <dt>ID</dt>
              <dd>{company.company_id}</dd>

              <dt>Ngày tạo</dt>
              <dd>{new Date(company.created_at).toLocaleDateString('vi-VN')}</dd>

              <dt>Cập nhật lần cuối</dt>
              <dd>{new Date(company.updated_at).toLocaleDateString('vi-VN')}</dd>
            </dl>
          </section>

          <section className="card">
            <h4>Hành động</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link href={`/companies/${company.company_id}/edit`} className="btn btn-block">
                ✏️ Sửa hồ sơ
              </Link>
              <DeleteCompanyButton companyId={company.company_id} companyName={company.company_name} />
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
