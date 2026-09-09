import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import CompanyForm from '@/components/features/CompanyForm';

/**
 * Company Create Page
 * Corresponds to Flask: templates/add_company.html (create mode)
 * Route: /companies/new
 */
export default async function CompanyNewPage() {
  const t = await getTranslations('companiesNewPage');
  return (
    // CHUYỂN 09/2026 (audit CSS): bỏ div "page-container"/"form-container"
    // ngoài cùng — class ảo, main.content đã lo container rồi.
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">
            <Link href="/companies">{t('backToList')}</Link>
          </span>
          <h1>{t('title')}</h1>
          <p className="lede">{t('lede')}</p>
        </div>
      </div>

      <CompanyForm mode="create" />
    </>
  );
}
