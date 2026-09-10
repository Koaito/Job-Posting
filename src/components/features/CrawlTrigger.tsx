'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { startCrawl, getCrawlStatus, getCrawlLogs } from '@/app/actions/crawl';
import type { CrawlStatus, CrawlLog } from '@/types/crawl';
import { crawlStatusBadgeClass, crawlStatusLabel } from '@/lib/crawl/badges';
import { toIntlLocale } from '@/i18n/config';

/**
 * Form kích hoạt crawl đơn lẻ + khung "Log live" — dùng ở trang /crawl.
 * CHỈ hiện form cho role 'admin' (backend require_admin cho POST /crawl,
 * ẩn hẳn UI cho ss_team thường thay vì để bấm rồi nhận 403 — cùng
 * pattern đã áp dụng ở StaffAccountsManager).
 *
 * Log live: poll GET /crawl/{run_id}/logs mỗi 2s với after_id = last_id
 * của lần gọi trước (xem docstring backend) — dừng poll khi status
 * không còn 'queued'/'running'. Trạng thái run cũng tự poll GET
 * /crawl/{run_id} song song để cập nhật progress/status.
 *
 * i18n (Giai đoạn 2, nhóm 5, 09/2026): dịch label/nút bấm qua
 * `useTranslations('crawlTrigger')`. crawlStatusLabel() (lib/crawl/
 * badges.ts) giờ đã dịch theo `t` namespace `crawlStatus` (đợt sau).
 * `toLocaleTimeString('vi-VN')` — đã đổi sang `dateLocale` (qua
 * `useLocale()`) ở đợt Polish sau (09/2026), method thứ 3 bị bỏ sót lần
 * quét trước (commit `00cdf67`), nay đã đồng bộ.
 */

interface CrawlTriggerProps {
  isAdmin: boolean;
  sources: Record<string, Record<string, string>>;
  /** Run gần nhất (bất kể status) — hiện log ngay khi vào trang, kể cả không có gì đang chạy. */
  initialRun: CrawlStatus | null;
}

const POLL_INTERVAL_MS = 2000;

export default function CrawlTrigger({ isAdmin, sources, initialRun }: CrawlTriggerProps) {
  const t = useTranslations('crawlTrigger');
  const tCrawlStatus = useTranslations('crawlStatus');
  const dateLocale = toIntlLocale(useLocale());
  const router = useRouter();
  const sourceKeys = Object.keys(sources);

  const [selectedSource, setSelectedSource] = useState(sourceKeys[0] || '');
  const [selectedCategory, setSelectedCategory] = useState(() => {
    const firstSourceCategories = sourceKeys[0] ? Object.keys(sources[sourceKeys[0]] || {}) : [];
    return firstSourceCategories[0] || '';
  });
  const [pages, setPages] = useState('');
  const [maxJobs, setMaxJobs] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeRunId, setActiveRunId] = useState<string | null>(initialRun?.run_id || null);
  const [runStatus, setRunStatus] = useState<CrawlStatus | null>(initialRun);
  const [logs, setLogs] = useState<CrawlLog[]>([]);
  const lastIdRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const categoryOptions = selectedSource ? Object.entries(sources[selectedSource] || {}) : [];

  /**
   * Đổi nguồn -> reset về category đầu tiên của nguồn mới. Xử lý ngay
   * trong handler onChange (handleSourceChange bên dưới) thay vì
   * useEffect + setState (cascading render, eslint react-hooks/
   * set-state-in-effect chặn pattern này) — đổi source là 1 sự kiện
   * người dùng rõ ràng, không phải "đồng bộ với hệ thống ngoài" nên
   * effect không phải công cụ đúng ở đây.
   */
  const handleSourceChange = (newSource: string) => {
    setSelectedSource(newSource);
    const firstCategory = Object.keys(sources[newSource] || {})[0];
    setSelectedCategory(firstCategory || '');
  };

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const pollOnce = useCallback(async (runId: string) => {
    const [status, logsResult] = await Promise.all([
      getCrawlStatus(runId),
      getCrawlLogs(runId, lastIdRef.current),
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = await startCrawl({
      source: selectedSource,
      category: selectedCategory,
      pages: pages ? Number(pages) : undefined,
      max_jobs: maxJobs ? Number(maxJobs) : undefined,
    });

    setSubmitting(false);

    if (result.success && result.result) {
      setLogs([]);
      lastIdRef.current = 0;
      setActiveRunId(result.result.run_id);
    } else {
      setError(result.error || t('crawlFailed'));
    }
  };

  /**
   * BUG FIX (09/2026): trước đây `isRunActive` chỉ dựa vào runStatus của
   * activeRunId (lượt đang theo dõi) mà không so nguồn — khoá luôn cả
   * dropdown "Nguồn" lẫn nút submit, khiến không đổi sang nguồn khác để
   * chạy song song được, dù backend chỉ khoá 409 khi CÙNG 1 nguồn đang
   * queued/running (xem Scrap_JD/api/routers/crawl.py:110, comment
   * "Trả 409 NGAY nếu source này đang có 1 lượt..."). Sửa: chỉ coi là
   * "đang chạy" nếu lượt đang theo dõi CÙNG nguồn với nguồn đang chọn
   * trên form — đổi sang nguồn khác thì mở khoá lại bình thường.
   */
  const isRunActive =
    (runStatus?.status === 'queued' || runStatus?.status === 'running') &&
    runStatus.source === selectedSource;

  return (
    <div>
      {isAdmin ? (
        <form onSubmit={handleSubmit} className="card" style={{ marginBottom: '22px' }}>
          <h4 style={{ marginTop: 0 }}>{t('newCrawlTitle')}</h4>
          {error && <div className="flash flash-error" style={{ marginBottom: '12px' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="source">{t('sourceLabel')}</label>
              <select
                id="source"
                value={selectedSource}
                onChange={(e) => handleSourceChange(e.target.value)}
                disabled={submitting}
              >
                {sourceKeys.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="category">{t('categoryLabel')}</label>
              <select
                id="category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                disabled={submitting || isRunActive}
              >
                {categoryOptions.map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="pages">{t('pagesLabel')}</label>
              <input
                id="pages"
                type="number"
                min={1}
                max={20}
                value={pages}
                onChange={(e) => setPages(e.target.value)}
                placeholder={t('pagesPlaceholder')}
                disabled={submitting || isRunActive}
                style={{ width: '110px' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="max_jobs">{t('maxJobsLabel')}</label>
              <input
                id="max_jobs"
                type="number"
                min={1}
                max={1000}
                value={maxJobs}
                onChange={(e) => setMaxJobs(e.target.value)}
                placeholder={t('maxJobsPlaceholder')}
                disabled={submitting || isRunActive}
                style={{ width: '130px' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting || isRunActive || !selectedSource || !selectedCategory}>
              {submitting ? t('sending') : isRunActive ? t('runInProgress') : t('startCrawl')}
            </button>
          </div>
          <p className="muted" style={{ fontSize: '12px', marginTop: '8px', marginBottom: 0 }}>
            {t('oneRunPerSourceNote')}
          </p>
        </form>
      ) : (
        <div className="card" style={{ marginBottom: '22px' }}>
          <p className="muted" style={{ margin: 0 }}>
            {t('adminOnlyPrefix')} <strong>admin</strong> {t('adminOnlySuffixTrigger')}
          </p>
        </div>
      )}

      <div className="card">
        <h4 style={{ marginTop: 0 }}>{t('logLiveTitle')}</h4>
        {runStatus ? (
          <div style={{ marginBottom: '12px' }}>
            <p style={{ margin: '0 0 4px 0' }}>
              <strong>{runStatus.source}</strong> / {runStatus.category} —{' '}
              {/* BUG FIX (audit CSS 09/2026): "status-chip status-open/
                  status-closed" là class domain job, tự bịa ở đây không
                  khớp CSS nào. Domain crawl dùng family khác hẳn: .badge
                  + badge-info/badge-success/badge-danger (xem
                  lib/crawl/badges.ts) — khớp CRAWL_STATUS_BADGE thật
                  (crawler_client/crawl.py), cũng hiện nhãn tiếng Việt
                  thay vì in thẳng status tiếng Anh (queued/running/...). */}
              <span className={`badge ${crawlStatusBadgeClass(runStatus.status)}`}>
                {crawlStatusLabel(runStatus.status, tCrawlStatus)}
              </span>
            </p>
            {runStatus.progress && (
              <p className="muted" style={{ margin: 0, fontSize: '13px' }}>
                {t('progressLine', {
                  fetched: runStatus.progress.fetched,
                  inserted: runStatus.progress.inserted,
                  time: new Date(runStatus.progress.last_update).toLocaleTimeString(dateLocale),
                })}
              </p>
            )}
            {runStatus.error && (
              <p style={{ color: '#B23A22', margin: '4px 0 0 0', fontSize: '13px' }}>{runStatus.error}</p>
            )}
          </div>
        ) : (
          <p className="muted">{t('neverCrawled')}</p>
        )}

        <div
          style={{
            maxHeight: '320px',
            overflowY: 'auto',
            background: '#1e1e1e',
            color: '#d4d4d4',
            fontFamily: 'monospace',
            fontSize: '12px',
            padding: '12px',
            borderRadius: '6px',
          }}
        >
          {logs.length > 0 ? (
            logs.map((log) => (
              <div key={log.id}>
                <span style={{ opacity: 0.6 }}>[{new Date(log.created_at).toLocaleTimeString(dateLocale)}]</span>{' '}
                <span style={{ color: log.level === 'ERROR' ? '#f48771' : log.level === 'WARNING' ? '#dcdcaa' : '#d4d4d4' }}>
                  {log.message}
                </span>
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
