import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getJobEnums } from '@/app/actions/jobs';
import JobForm from '@/components/features/JobForm';

/**
 * Job Create Page
 * Corresponds to Flask: templates/job_form.html (create mode)
 * Route: /jobs/new
 */

export default async function JobNewPage() {
  const [t, enums] = await Promise.all([
    getTranslations('jobsNewPage'),
    getJobEnums(),
  ]);
  return (
    // CHUYỂN 09/2026 (audit CSS): bỏ div "page-container" ngoài cùng và
    // "form-container" bọc JobForm — cả 2 đều là class ảo, không tồn
    // tại trong CSS nào. main.content (root layout.tsx) đã lo container
    // rồi, JobForm tự có "card form-card" của chính nó.
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">
            <Link href="/jobs">{t('backToList')}</Link>
          </span>
          <h1>{t('title')}</h1>
          <p className="lede">{t('lede')}</p>
        </div>
      </div>

      <JobForm mode="create" enums={enums} />
    </>
  );
}
