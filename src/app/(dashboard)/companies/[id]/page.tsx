import { getCompanyById } from '@/app/actions/companies';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import DeleteCompanyButton from '@/components/features/DeleteCompanyButton';
import { partnershipPotentialClass, partnershipPotentialLabel } from '@/lib/companies/potential';

/**
 * Company Detail Page
 * Corresponds to Flask: templates/company_detail.html
 * Route: /companies/[id]
 *
 * Phần "Người liên hệ HR" của template Flask gốc CHƯA đưa vào đây —
 * đó là việc của actions/contacts.ts (vẫn còn stub, TODO riêng), không
 * gộp vào đợt companies này để giữ phạm vi rõ ràng.
 */
export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = await getCompanyById(id);

  if (!company) {
    notFound();
  }

  return (
    <div className="page-container">
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
        <div className="page-head-actions">
          <Link href={`/companies/${company.company_id}/edit`} className="btn btn-primary">
            Sửa hồ sơ công ty
          </Link>
        </div>
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

          <section className="card">
            <h4>Người liên hệ HR</h4>
            <p className="muted">🚧 Chưa dựng (chờ actions/contacts.ts — xem TODO chung).</p>
          </section>
        </div>

        <aside className="detail-sidebar">
          <section className="card">
            <h4>Thông tin chung</h4>
            <dl className="detail-list">
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

              {company.website && (
                <>
                  <dt>Website</dt>
                  <dd>
                    <a href={company.website} target="_blank" rel="noopener noreferrer" className="link">
                      {company.website}
                    </a>
                  </dd>
                </>
              )}

              {company.fanpage_url && (
                <>
                  <dt>Fanpage</dt>
                  <dd>
                    <a href={company.fanpage_url} target="_blank" rel="noopener noreferrer" className="link">
                      Xem fanpage ↗
                    </a>
                  </dd>
                </>
              )}

              {company.linkedin_url && (
                <>
                  <dt>LinkedIn</dt>
                  <dd>
                    <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer" className="link">
                      Xem LinkedIn ↗
                    </a>
                  </dd>
                </>
              )}
            </dl>
          </section>

          <section className="card">
            <h4>Thông tin hệ thống</h4>
            <dl className="detail-list">
              <dt>ID</dt>
              <dd className="font-mono">{company.company_id}</dd>

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
    </div>
  );
}
