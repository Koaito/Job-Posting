import { getTranslations } from 'next-intl/server';
import MaintenanceJobCard from '@/components/features/MaintenanceJobCard';
import {
  MAINTENANCE_JOBS,
  MAINTENANCE_JOB_TYPES_REQUIRE_LIMIT,
  maintenanceJobLabel,
  maintenanceJobDescription,
} from '@/lib/maintenance/jobs';
import type { MaintenanceStatus } from '@/types/crawl';

/**
 * Tab "Bảo trì dữ liệu" ở /crawl — 5 card cố định (backfill_company_profiles/
 * enrich_profile_from_website/enrich_web_info/get_fb_linkedin/
 * check_expired_jobs), đối xứng .crawl-sources--fixed-2col (15-crawl.css).
 *
 * THÊM 09/2026 (rà soát #3, chat139) — module còn thiếu hoàn toàn ở
 * Next.js trước đợt này.
 *
 * i18n (đợt sau, 09/2026): chuyển thành async function để gọi
 * `getTranslations('maintenanceJobs')` — label/description giờ dịch tại
 * đây (Server Component) rồi truyền STRING đã dịch xuống MaintenanceJobCard
 * (Client Component) qua props, đúng pattern chung của dự án (Server
 * Component nắm i18n, Client Component chỉ nhận string đã dịch).
 */

interface MaintenanceGridProps {
  isAdmin: boolean;
  /** job_type -> lượt chạy 'queued'/'running' gần nhất (nếu có) — xem page.tsx. */
  activeRuns: Record<string, MaintenanceStatus>;
}

export default async function MaintenanceGrid({ isAdmin, activeRuns }: MaintenanceGridProps) {
  const t = await getTranslations('maintenanceJobs');

  return (
    <div className="crawl-sources crawl-sources--fixed-2col">
      {MAINTENANCE_JOBS.map((job) => (
        <MaintenanceJobCard
          key={job.jobType}
          jobType={job.jobType}
          label={maintenanceJobLabel(job.jobType, t)}
          description={maintenanceJobDescription(job.jobType, t)}
          costsMoney={job.costsMoney}
          supportsDryRun={job.supportsDryRun}
          requireLimit={MAINTENANCE_JOB_TYPES_REQUIRE_LIMIT.has(job.jobType)}
          isAdmin={isAdmin}
          initialRun={activeRuns[job.jobType] || null}
        />
      ))}
    </div>
  );
}
