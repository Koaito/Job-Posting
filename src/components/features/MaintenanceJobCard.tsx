'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { triggerMaintenance, getMaintenanceStatus, getMaintenanceLogs } from '@/app/actions/crawl';
import type { MaintenanceStatus, MaintenanceLog } from '@/types/crawl';
import { crawlStatusBadgeClass, crawlStatusLabel } from '@/lib/crawl/badges';
import { MAINTENANCE_CHECK_EXPIRED_JOB_TYPE } from '@/lib/maintenance/jobs';

/**
 * 1 card kích hoạt + log live cho 1 job bảo trì dữ liệu — mirror
 * CrawlTrigger.tsx (cùng pattern poll status+logs mỗi 2s, dừng khi
 * status không còn 'queued'/'running') nhưng generic hoá theo job_type
 * thay vì source/category.
 *
 * THÊM 09/2026 (rà soát #3, chat139) — tab "Bảo trì dữ liệu" ở /crawl,
 * module còn thiếu hoàn toàn ở Next.js trước đợt này.
 *
 * ĐƠN GIẢN HOÁ có chủ ý so với Flask gốc: Flask gộp log của cả 5 job
 * qua 1 request /maintenance/logs-batch.json (poll 1 lần cho cả 5
 * card) — ở đây mỗi card tự poll log RIÊNG (5 request thay vì 1 khi cả
 * 5 job cùng chạy), đổi lấy code đơn giản hơn nhiều lần, chấp nhận
 * được vì trong thực tế hiếm khi chạy đồng thời cả 5 job bảo trì.
 *
 * i18n (Giai đoạn 2, nhóm 5, 09/2026): dịch label/nút bấm qua
 * `useTranslations('maintenanceJobCard')`. crawlStatusLabel() dùng
 * chung `t` namespace `crawlStatus` (lib/crawl/badges.ts).
 *
 * i18n (đợt sau nữa, 09/2026): `label`/`description` (props nhận từ
 * MaintenanceGrid.tsx) giờ ĐÃ là string đã dịch — MaintenanceGrid (Server
 * Component) tự gọi `maintenanceJobLabel()`/`maintenanceJobDescription()`
 * (lib/maintenance/jobs.ts, namespace `maintenanceJobs`) trước khi truyền
 * xuống đây, component này (Client Component) chỉ hiển thị nguyên văn,
 * không tự tra bảng dịch.
 *
 * `toLocaleTimeString('vi-VN')` (log live) CỐ Ý CHƯA đổi — khác
 * `toLocaleDateString`/`toLocaleString('vi-VN')` đã xử lý ở đợt Polish
 * "định dạng ngày/giờ theo locale" (commit `00cdf67`) vì đó là quét theo
 * đúng 2 method đó; `toLocaleTimeString` là method thứ 3 chưa nằm trong
 * phạm vi lần quét đó — vẫn treo lại cho Polish.
 */

interface MaintenanceJobCardProps {
  jobType: string;
  label: string;
  description: string;
  costsMoney: boolean;
  supportsDryRun?: boolean;
  requireLimit: boolean;
  isAdmin: boolean;
  initialRun: MaintenanceStatus | null;
}

const POLL_INTERVAL_MS = 2000;

export default function MaintenanceJobCard({
  jobType,
  label,
  description,
  costsMoney,
  supportsDryRun,
  requireLimit,
  isAdmin,
  initialRun,
}: MaintenanceJobCardProps) {
  const t = useTranslations('maintenanceJobCard');
  const tCrawlStatus = useTranslations('crawlStatus');
  const router = useRouter();

  const [limit, setLimit] = useState('');
  const [dryRun, setDryRun] = useState(false);
  const [checkDeadlineOnly, setCheckDeadlineOnly] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeRunId, setActiveRunId] = useState<string | null>(
    initialRun?.status === 'queued' || initialRun?.status === 'running' ? initialRun.run_id : null
  );
  const [runStatus, setRunStatus] = useState<MaintenanceStatus | null>(initialRun);
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const lastIdRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const pollOnce = useCallback(async (runId: string) => {
    const [status, logsResult] = await Promise.all([
      getMaintenanceStatus(runId),
      getMaintenanceLogs(runId, lastIdRef.current),
    ]);

    if (status) {
      setRunStatus(status);
    }
    if (logsResult.items.length > 0) {
      setLogs((prev) => [...prev, ...logsResult.items]);
      lastIdRef.current = logsResult.last_id;
    }

    if (status && status.status !== 'queued' && status.status !== 'running') {
      stopPolling();
      router.refresh();
    }
  }, [router, stopPolling]);

  useEffect(() => {
    if (!activeRunId) return undefined;

    pollOnce(activeRunId);
    pollTimerRef.current = setInterval(() => pollOnce(activeRunId), POLL_INTERVAL_MS);

    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRunId]);

  const isRunActive = runStatus?.status === 'queued' || runStatus?.status === 'running';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (requireLimit && !limit) {
      setError(t('limitRequiredError', { label }));
      return;
    }

    setSubmitting(true);
    const result = await triggerMaintenance(jobType, {
      limit: limit ? Number(limit) : undefined,
      dry_run: jobType === MAINTENANCE_CHECK_EXPIRED_JOB_TYPE ? dryRun : undefined,
      check_deadline_only: jobType === MAINTENANCE_CHECK_EXPIRED_JOB_TYPE ? checkDeadlineOnly : undefined,
    });
    setSubmitting(false);

    if (result.success && result.result) {
      setLogs([]);
      lastIdRef.current = 0;
      setActiveRunId(result.result.run_id);
    } else {
      setError(result.error || t('triggerFailed'));
    }
  };

  return (
    <div className="crawl-source-card">
      <h2>
        {label}
        {costsMoney && <span className="badge badge-warning maint-cost-badge">{t('costsMoneyBadge')}</span>}
      </h2>
      <p className="crawl-source-sub">{description}</p>

      {isAdmin ? (
        <form onSubmit={handleSubmit} className="form-card">
          {error && <div className="flash flash-error" style={{ marginBottom: '12px' }}>{error}</div>}
          <div className="form-grid">
            <label className="span-2">
              {t('limitLabel')}{requireLimit ? t('limitRequiredSuffix') : t('limitOptionalSuffix')}
              <input
                type="number"
                min={1}
                max={5000}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                disabled={submitting || isRunActive}
                required={requireLimit}
              />
            </label>
            {supportsDryRun && (
              <div className="span-2 maint-checkbox-col">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={dryRun}
                    onChange={(e) => setDryRun(e.target.checked)}
                    disabled={submitting || isRunActive}
                  />
                  {t('dryRunOption')}
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={checkDeadlineOnly}
                    onChange={(e) => setCheckDeadlineOnly(e.target.checked)}
                    disabled={submitting || isRunActive}
                  />
                  {t('checkDeadlineOption')}
                </label>
              </div>
            )}
            <div className="form-actions span-4">
              <button type="submit" className="btn btn-primary" disabled={submitting || isRunActive}>
                {submitting ? t('sending') : isRunActive ? t('running') : t('runButton')}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          {t('adminOnlyPrefix')} <strong>admin</strong> {t('adminOnlySuffixMaintenance')}
        </p>
      )}

      {runStatus && (
        <div className="crawl-progress">
          <p className="crawl-progress-line">
            <span className={`badge ${crawlStatusBadgeClass(runStatus.status)}`}>
              {crawlStatusLabel(runStatus.status, tCrawlStatus)}
            </span>{' '}
            {runStatus.triggered_by_name && <span className="muted">— {runStatus.triggered_by_name}</span>}
          </p>
          {runStatus.error && (
            <p style={{ color: '#B23A22', margin: '4px 0 0 0', fontSize: '13px' }}>{runStatus.error}</p>
          )}
          {runStatus.stats && (
            <details style={{ marginTop: '6px' }}>
              <summary className="muted" style={{ cursor: 'pointer', fontSize: '12.5px' }}>{t('resultsSummary')}</summary>
              <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap' }}>{JSON.stringify(runStatus.stats, null, 2)}</pre>
            </details>
          )}
        </div>
      )}

      <div className="crawl-log-card maint-log-card">
        <div className="crawl-log-head">
          <span>{t('logLiveTitle')}</span>
        </div>
        <div className="crawl-log-body maint-log-body">
          {logs.length > 0 ? (
            logs.map((log) => (
              <div key={log.id} className={`crawl-log-line ${log.level === 'ERROR' ? 'is-error' : log.level === 'WARNING' ? 'is-warning' : ''}`}>
                <span style={{ opacity: 0.6 }}>[{new Date(log.created_at).toLocaleTimeString('vi-VN')}]</span> {log.message}
              </div>
            ))
          ) : (
            <span style={{ opacity: 0.6 }}>{t('noLogs')}</span>
          )}
        </div>
      </div>
    </div>
  );
}
