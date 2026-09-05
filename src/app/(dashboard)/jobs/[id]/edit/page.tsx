/**
 * Job Edit Page
 * Matches Flask: blueprints/jobs.py::edit()
 */

import { notFound } from 'next/navigation';
import { getJobById } from '@/app/actions/jobs';
import JobForm from '@/components/features/JobForm';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function JobEditPage({ params }: PageProps) {
  const { id } = await params;
  const job = await getJobById(id);

  if (!job) {
    notFound();
  }

  return (
    // CHUYỂN 09/2026 (audit CSS): bỏ div "page-container" ngoài cùng —
    // class ảo. "page-header" cũng là class ảo (không phải "page-head"
    // thật) — main.content đã lo container, chỉ cần header đúng class.
    <>
      <div className="page-head">
        <h1>Sửa Job: {job.job_title}</h1>
      </div>

      <JobForm mode="edit" initialData={job} />
    </>
  );
}
