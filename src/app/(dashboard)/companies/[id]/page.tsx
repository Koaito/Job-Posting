import { getCompanyById } from '@/app/actions/companies';
import { getContactsByCompany } from '@/app/actions/contacts';
import { getCurrentUser } from '@/app/actions/auth';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
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
  const t = await getTranslations('companyDetailPage');
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
            <Link href="/companies">{t('backToList')}</Link>
          </span>
          <h1>{company.company_name}</h1>
          <p className="lede">
            {company.industry || t('industryUnknown')}
            {company.province_name && ` · ${company.province_name}`}
            {company.company_size && ` · ${t('staffCount', { count: company.company_size })}`}
          </p>
        </div>
        {/* Bỏ div "page-head-actions" bọc ngoài (class ảo) — .page-head
            vốn đã là flex space-between, nút chỉ cần là con trực tiếp. */}
        <Link href={`/companies/${company.company_id}/edit`} className="btn btn-primary">
          {t('editCompany')}
        </Link>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          <section className="card">
            <h4>{t('postedJobs', { count: company.jobs?.length || 0 })}</h4>
            {company.jobs && company.jobs.length > 0 ? (
              <ul className="applicant-list">
                {company.jobs.map((job) => (
                  <li key={job.job_id}>
                    <Link href={`/jobs/${job.job_id}`}><strong>{job.job_title}</strong></Link>
                    <span className="muted">
                      {' '}
                      {job.level_code || '—'} · {job.province_name || '—'} ·{' '}
                      {job.job_status === 'OPEN' ? t('statusOpen') : t('statusClosed')}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">{t('noJobs')}</p>
            )}
            <Link href="/jobs/new" className="btn btn-ghost" style={{ marginTop: '8px' }}>
              {t('addJobForCompany')}
            </Link>
          </section>

          {isStaff && (
            <section className="card">
              <h4>{t('hrContacts')}</h4>
              <CompanyContactsManager companyId={company.company_id} initialContacts={contacts} />
            </section>
          )}
        </div>

        {/* BUG FIX (audit CSS 09/2026): "detail-sidebar" không tồn tại,
            class thật là "detail-side" (public/css/06-detail-page.css,
            gồm cả position: sticky) — giống fix ở jobs/[id]/page.tsx. */}
        <aside className="detail-side">
          <section className="card">
            <h4>{t('generalInfo')}</h4>
            {/* BUG FIX: "detail-list" không tồn tại — class thật cho
                khối dt/dd kiểu này là "kv" (public/css/06-detail-page.css,
                dùng chung với company_detail.html gốc). */}
            <dl className="kv">
              <dt>{t('potential')}</dt>
              <dd>
                <span className={`fit-chip ${partnershipPotentialClass(company.partnership_potential)}`}>
                  {partnershipPotentialLabel(company.partnership_potential)}
                </span>
              </dd>

              {company.tax_id && (
                <>
                  <dt>{t('taxId')}</dt>
                  <dd>{company.tax_id}</dd>
                </>
              )}

              {company.address && (
                <>
                  <dt>{t('address')}</dt>
                  <dd>{company.address}</dd>
                </>
              )}

              {/* Bỏ class "link" (ảo) ở 3 thẻ <a> dưới đây — "kv dd a"
                  (public/css/06-detail-page.css) đã tự tô màu accent cho
                  mọi link trong danh sách này rồi, giống fix ở
                  jobs/[id]/page.tsx. */}
              {company.website && (
                <>
                  <dt>{t('website')}</dt>
                  <dd>
                    <a href={company.website} target="_blank" rel="noopener noreferrer">
                      {company.website}
                    </a>
                  </dd>
                </>
              )}

              {company.fanpage_url && (
                <>
                  <dt>{t('fanpage')}</dt>
                  <dd>
                    <a href={company.fanpage_url} target="_blank" rel="noopener noreferrer">
                      {t('viewFanpage')}
                    </a>
                  </dd>
                </>
              )}

              {company.linkedin_url && (
                <>
                  <dt>{t('linkedin')}</dt>
                  <dd>
                    <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer">
                      {t('viewLinkedin')}
                    </a>
                  </dd>
                </>
              )}
            </dl>
          </section>

          <section className="card">
            <h4>{t('systemInfo')}</h4>
            {/* "detail-list" → "kv" (như trên). Bỏ luôn "font-mono" ở
                dd ID — không phải class thật (--font-mono chỉ là CSS
                variable dùng bên trong các selector khác như .skill-tag,
                không có sẵn dạng utility class đứng riêng); job/[id]/page.tsx
                (đã fix) cũng hiện ID dạng <dd> thường, không gắn class gì. */}
            <dl className="kv">
              <dt>ID</dt>
              <dd>{company.company_id}</dd>

              <dt>{t('createdAt')}</dt>
              {/* CỐ Ý CHƯA dịch: toLocaleDateString('vi-VN') — thuộc
                  phạm vi Polish, không xử lý ở đợt Language này. */}
              <dd>{new Date(company.created_at).toLocaleDateString('vi-VN')}</dd>

              <dt>{t('updatedAt')}</dt>
              <dd>{new Date(company.updated_at).toLocaleDateString('vi-VN')}</dd>
            </dl>
          </section>

          <section className="card">
            <h4>{t('actions')}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link href={`/companies/${company.company_id}/edit`} className="btn btn-block">
                ✏️ {t('editProfile')}
              </Link>
              <DeleteCompanyButton companyId={company.company_id} companyName={company.company_name} />
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
