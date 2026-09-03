import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCompanyById } from '@/app/actions/companies';
import CompanyForm from '@/components/features/CompanyForm';

/**
 * Company Edit Page
 * Corresponds to Flask: templates/add_company.html (edit mode)
 * Route: /companies/[id]/edit
 */
export default async function CompanyEditPage({
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
            <Link href={`/companies/${company.company_id}`}>← Quay lại</Link>
          </span>
          <h1>Sửa công ty: {company.company_name}</h1>
        </div>
      </div>

      <div className="form-container">
        <CompanyForm mode="edit" initialData={company} />
      </div>
    </div>
  );
}
