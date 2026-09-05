import MaintenanceJobCard from '@/components/features/MaintenanceJobCard';
import { MAINTENANCE_JOBS, MAINTENANCE_JOB_TYPES_REQUIRE_LIMIT } from '@/lib/maintenance/jobs';
import type { MaintenanceStatus } from '@/types/crawl';

/**
 * Tab "Bảo trì dữ liệu" ở /crawl — 5 card cố định (backfill_company_profiles/
 * enrich_profile_from_website/enrich_web_info/get_fb_linkedin/
 * check_expired_jobs), đối xứng .crawl-sources--fixed-2col (15-crawl.css).
 *
 * THÊM 09/2026 (rà soát #3, chat139) — module còn thiếu hoàn toàn ở
 * Next.js trước đợt này.
 */

interface MaintenanceGridProps {
  isAdmin: boolean;
  /** job_type -> lượt chạy 'queued'/'running' gần nhất (nếu có) — xem page.tsx. */
  activeRuns: Record<string, MaintenanceStatus>;
}

export default function MaintenanceGrid({ isAdmin, activeRuns }: MaintenanceGridProps) {
  return (
    <div className="crawl-sources crawl-sources--fixed-2col">
      {MAINTENANCE_JOBS.map((job) => (
        <MaintenanceJobCard
          key={job.jobType}
          jobType={job.jobType}
          label={job.label}
          description={job.description}
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
