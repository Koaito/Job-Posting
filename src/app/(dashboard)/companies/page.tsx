import { getCompanies } from '@/app/actions/companies';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
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
  const t = await getTranslations('companiesPage');
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
          <span className="eyebrow">{t('eyebrow')}</span>
          <h1>{t('title')}</h1>
          <p className="lede">
            {t('lede')}
          </p>
        </div>
        {/* Bỏ div "page-head-actions" bọc ngoài (cũng là class ảo) —
            .page-head vốn đã là flex justify-content: space-between,
            nút chỉ cần là con trực tiếp (xem templates/companies.html gốc). */}
        <Link href="/companies/new" className="btn btn-primary">
          {t('addNew')}
        </Link>
      </div>

      <div className="filter-bar" style={{ marginBottom: '22px' }}>
        <form method="get" action="/companies" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input
            type="search"
            name="keyword"
            placeholder={t('searchPlaceholder')}
            defaultValue={resolvedSearchParams.keyword}
            style={{ flex: '1 1 300px', minWidth: '200px' }}
          />
          <select name="province" defaultValue={resolvedSearchParams.province || ''}>
            <option value="">{t('allProvinces')}</option>
            {PROVINCE_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button type="submit" className="btn">{t('filterButton')}</button>
          {hasFilters && <Link href="/companies" className="btn">{t('clearFilters')}</Link>}
        </form>
      </div>

      <p className="result-count">
        {companies.length > 0
          ? t('resultCountWithRange', { total, from: offset + 1, to: offset + companies.length })
          : t('resultCount', { total })}
      </p>

      {companies.length > 0 ? (
        <>
          <div className="contact-table-wrap">
            <table className="contact-table">
              <thead>
                <tr>
                  <th>{t('colCompany')}</th>
                  <th>{t('colIndustry')}</th>
                  <th>{t('colProvince')}</th>
                  <th>{t('colSize')}</th>
                  <th className="col-potential">{t('colPotential')}</th>
                  <th>{t('colWebsite')}</th>
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
                          {t('websiteLink')}
                        </a>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="actions-cell">
                      <Link className="btn btn-text" href={`/companies/${company.company_id}`}>{t('view')}</Link>
                      <Link className="btn btn-text" href={`/companies/${company.company_id}/edit`}>{t('edit')}</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              {page > 1 && (
                <Link href={qs(page - 1)} className="page-btn">{t('prevPage')}</Link>
              )}
              <span className="page-status">{t('pageStatus', { page, totalPages })}</span>
              {page < totalPages && (
                <Link href={qs(page + 1)} className="page-btn">{t('nextPage')}</Link>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <p>{t('empty')}</p>
          {hasFilters ? (
            <Link href="/companies" className="btn">{t('clearFilters')}</Link>
          ) : (
            <Link href="/companies/new" className="btn btn-primary">{t('addFirst')}</Link>
          )}
        </div>
      )}
    </>
  );
}
