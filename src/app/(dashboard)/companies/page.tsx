import { getCompanies } from '@/app/actions/companies';
import Link from 'next/link';
import PotentialQuickEdit from '@/components/features/PotentialQuickEdit';

/**
 * Companies List Page
 * Corresponds to Flask: templates/companies.html
 * Route: /companies
 *
 * BUG FIX (audit 09/2026 #16): trước đây "TODO: Implement in Phase 4"
 * — actions/companies.ts đã đủ từ đợt trước, chỉ chưa có trang thật.
 */

interface SearchParams {
  keyword?: string;
  province?: string;
  page?: string;
}

const PROVINCE_OPTIONS = ['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng'];

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const page = parseInt(resolvedSearchParams.page || '1');
  const limit = 50;
  const offset = (page - 1) * limit;

  const { items: companies, total } = await getCompanies({
    keyword: resolvedSearchParams.keyword,
    province: resolvedSearchParams.province,
    limit,
    offset,
  });

  const totalPages = Math.ceil(total / limit);
  const hasFilters = Boolean(resolvedSearchParams.keyword || resolvedSearchParams.province);
  const qs = (p: number) =>
    `/companies?page=${p}${resolvedSearchParams.keyword ? `&keyword=${resolvedSearchParams.keyword}` : ''}${resolvedSearchParams.province ? `&province=${resolvedSearchParams.province}` : ''}`;

  return (
    // BUG FIX (audit CSS 09/2026): bỏ div "page-container" bọc ngoài —
    // class ảo, không tồn tại trong CSS nào. main.content (root
    // layout.tsx) đã tự lo container/padding cho MỌI trang rồi (giống
    // fix đã áp dụng ở jobs/page.tsx).
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Career Hub / Doanh nghiệp</span>
          <h1>Database công ty đối tác</h1>
          <p className="lede">
            Hồ sơ công ty đã tiếp cận/crawl được — vào từng công ty để xem job đã đăng.
          </p>
        </div>
        {/* Bỏ div "page-head-actions" bọc ngoài (cũng là class ảo) —
            .page-head vốn đã là flex justify-content: space-between,
            nút chỉ cần là con trực tiếp (xem templates/companies.html gốc). */}
        <Link href="/companies/new" className="btn btn-primary">
          + Thêm công ty
        </Link>
      </div>

      <div className="filter-bar" style={{ marginBottom: '22px' }}>
        <form method="get" action="/companies" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input
            type="search"
            name="keyword"
            placeholder="Tìm theo tên công ty..."
            defaultValue={resolvedSearchParams.keyword}
            style={{ flex: '1 1 300px', minWidth: '200px' }}
          />
          <select name="province" defaultValue={resolvedSearchParams.province || ''}>
            <option value="">Mọi tỉnh/thành</option>
            {PROVINCE_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button type="submit" className="btn">Lọc</button>
          {hasFilters && <Link href="/companies" className="btn">Xóa lọc</Link>}
        </form>
      </div>

      <p className="result-count">
        {total} công ty phù hợp{companies.length > 0 ? ` — hiển thị ${offset + 1}–${offset + companies.length}` : ''}
      </p>

      {companies.length > 0 ? (
        <>
          <div className="contact-table-wrap">
            <table className="contact-table">
              <thead>
                <tr>
                  <th>Công ty</th>
                  <th>Lĩnh vực</th>
                  <th>Tỉnh/thành</th>
                  <th>Quy mô</th>
                  <th className="col-potential">Tiềm năng</th>
                  <th>Website</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr key={company.company_id}>
                    <td>
                      <strong>
                        <Link href={`/companies/${company.company_id}`}>{company.company_name}</Link>
                      </strong>
                    </td>
                    <td className="muted">{company.industry || '—'}</td>
                    <td>{company.province_name || '—'}</td>
                    <td className="muted">{company.company_size || '—'}</td>
                    <td>
                      <PotentialQuickEdit companyId={company.company_id} value={company.partnership_potential} />
                    </td>
                    <td>
                      {company.website ? (
                        <a className="btn btn-text" href={company.website} target="_blank" rel="noopener noreferrer">
                          Website ↗
                        </a>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="actions-cell">
                      <Link className="btn btn-text" href={`/companies/${company.company_id}`}>Xem</Link>
                      <Link className="btn btn-text" href={`/companies/${company.company_id}/edit`}>Sửa</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              {page > 1 && (
                <Link href={qs(page - 1)} className="page-btn">← Trang trước</Link>
              )}
              <span className="page-status">Trang {page} / {totalPages}</span>
              {page < totalPages && (
                <Link href={qs(page + 1)} className="page-btn">Trang sau →</Link>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <p>Chưa có công ty nào khớp bộ lọc.</p>
          {hasFilters ? (
            <Link href="/companies" className="btn">Xóa bộ lọc</Link>
          ) : (
            <Link href="/companies/new" className="btn btn-primary">Thêm công ty đầu tiên</Link>
          )}
        </div>
      )}
    </>
  );
}
