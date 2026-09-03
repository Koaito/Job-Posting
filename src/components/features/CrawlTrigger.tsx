'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { startCrawl, getCrawlStatus, getCrawlLogs } from '@/app/actions/crawl';
import type { CrawlStatus, CrawlLog } from '@/types/crawl';

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
 */

interface CrawlTriggerProps {
  isAdmin: boolean;
  sources: Record<string, Record<string, string>>;
  /** Run gần nhất (bất kể status) — hiện log ngay khi vào trang, kể cả không có gì đang chạy. */
  initialRun: CrawlStatus | null;
}

const POLL_INTERVAL_MS = 2000;

export default function CrawlTrigger({ isAdmin, sources, initialRun }: CrawlTriggerProps) {
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
      setError(result.error || 'Không thể kích hoạt crawl');
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
          <h4 style={{ marginTop: 0 }}>Kích hoạt crawl mới</h4>
          {error && <div className="flash flash-error" style={{ marginBottom: '12px' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-field">
              <label htmlFor="source">Nguồn</label>
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
            <div className="form-field">
              <label htmlFor="category">Ngành</label>
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
            <div className="form-field">
              <label htmlFor="pages">Số trang (tối đa 20)</label>
              <input
                id="pages"
                type="number"
                min={1}
                max={20}
                value={pages}
                onChange={(e) => setPages(e.target.value)}
                placeholder="Mặc định"
                disabled={submitting || isRunActive}
                style={{ width: '110px' }}
              />
            </div>
            <div className="form-field">
              <label htmlFor="max_jobs">Số JD tối đa</label>
              <input
                id="max_jobs"
                type="number"
                min={1}
                max={1000}
                value={maxJobs}
                onChange={(e) => setMaxJobs(e.target.value)}
                placeholder="Không giới hạn"
                disabled={submitting || isRunActive}
                style={{ width: '130px' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting || isRunActive || !selectedSource || !selectedCategory}>
              {submitting ? 'Đang gửi...' : isRunActive ? 'Đang có lượt chạy...' : '🕷️ Bắt đầu crawl'}
            </button>
          </div>
          <p className="muted" style={{ fontSize: '12px', marginTop: '8px', marginBottom: 0 }}>
            Mỗi nguồn chỉ chạy được 1 lượt tại 1 thời điểm — nguồn khác vẫn crawl song song bình thường.
          </p>
        </form>
      ) : (
        <div className="card" style={{ marginBottom: '22px' }}>
          <p className="muted" style={{ margin: 0 }}>
            Chỉ tài khoản <strong>admin</strong> mới kích hoạt được crawl mới. Bạn vẫn xem được log/lịch sử bên dưới.
          </p>
        </div>
      )}

      <div className="card">
        <h4 style={{ marginTop: 0 }}>Log live</h4>
        {runStatus ? (
          <div style={{ marginBottom: '12px' }}>
            <p style={{ margin: '0 0 4px 0' }}>
              <strong>{runStatus.source}</strong> / {runStatus.category} —{' '}
              <span className={`status-chip ${isRunActive ? 'status-open' : runStatus.status === 'error' ? 'status-closed' : ''}`}>
                {runStatus.status}
              </span>
            </p>
            {runStatus.progress && (
              <p className="muted" style={{ margin: 0, fontSize: '13px' }}>
                Đã tải: {runStatus.progress.fetched} · Đã lưu: {runStatus.progress.inserted} · Cập nhật lúc{' '}
                {new Date(runStatus.progress.last_update).toLocaleTimeString('vi-VN')}
              </p>
            )}
            {runStatus.error && (
              <p style={{ color: '#B23A22', margin: '4px 0 0 0', fontSize: '13px' }}>{runStatus.error}</p>
            )}
          </div>
        ) : (
          <p className="muted">Chưa từng crawl lần nào.</p>
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
                <span style={{ opacity: 0.6 }}>[{new Date(log.created_at).toLocaleTimeString('vi-VN')}]</span>{' '}
                <span style={{ color: log.level === 'ERROR' ? '#f48771' : log.level === 'WARNING' ? '#dcdcaa' : '#d4d4d4' }}>
                  {log.message}
                </span>
              </div>
            ))
          ) : (
            <span style={{ opacity: 0.6 }}>Chưa có log nào.</span>
          )}
        </div>
      </div>
    </div>
  );
}
