/**
 * Tests for CrawlTrigger Component
 * Mục #7 (rà soát kiến trúc 09/2026) — component trước đây chưa có test nào.
 *
 * Bao phủ:
 * - Ẩn form kích hoạt crawl khi isAdmin=false, chỉ hiện khung "Log live"
 *   (đúng docstring: chỉ role 'admin' mới thấy form, ss_team vẫn xem
 *   được log/lịch sử).
 * - Đổi "Nguồn" -> tự reset "Ngành" về category đầu tiên của nguồn mới
 *   (handleSourceChange, xử lý trong onChange chứ không phải useEffect).
 * - Submit gọi startCrawl() với đúng payload, thành công -> bắt đầu
 *   poll (getCrawlStatus/getCrawlLogs) qua setInterval.
 * - BUG FIX đã ghi trong component: isRunActive chỉ khoá form khi lượt
 *   đang theo dõi CÙNG NGUỒN với nguồn đang chọn — đổi sang nguồn khác
 *   thì mở khoá lại. Test riêng để không tái diễn bug cũ (so sánh
 *   runStatus theo activeRunId mà không xét nguồn).
 * - Dừng poll khi status không còn 'queued'/'running' (gọi router.refresh()).
 *
 * Dùng jest.useFakeTimers() để kiểm soát POLL_INTERVAL_MS (2000ms) thay
 * vì chờ thời gian thật — mọi advanceTimersByTime phải bọc trong act()
 * gián tiếp qua waitFor (RTL tự flush microtask sau khi timer chạy).
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import CrawlTrigger from '@/components/features/CrawlTrigger';
import { startCrawl, getCrawlStatus, getCrawlLogs } from '@/app/actions/crawl';
import { mockCrawlAccepted, mockCrawlStatus, mockCrawlLogsResponse, mockCrawlSources } from '../fixtures';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/app/actions/crawl', () => ({
  startCrawl: jest.fn(),
  getCrawlStatus: jest.fn(),
  getCrawlLogs: jest.fn(),
}));

describe('CrawlTrigger Component', () => {
  const mockRefresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (useRouter as jest.Mock).mockReturnValue({ refresh: mockRefresh });
    (getCrawlStatus as jest.Mock).mockResolvedValue(null);
    (getCrawlLogs as jest.Mock).mockResolvedValue({ last_id: 0, items: [] });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Quyền admin', () => {
    it('hiện form kích hoạt crawl khi isAdmin=true', () => {
      render(<CrawlTrigger isAdmin sources={mockCrawlSources} initialRun={null} />);

      expect(screen.getByRole('button', { name: /Bắt đầu crawl/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/Nguồn/i)).toBeInTheDocument();
    });

    it('ẩn form, chỉ hiện thông báo "chỉ admin" khi isAdmin=false', () => {
      render(<CrawlTrigger isAdmin={false} sources={mockCrawlSources} initialRun={null} />);

      expect(screen.queryByRole('button', { name: /Bắt đầu crawl/i })).not.toBeInTheDocument();
      expect(screen.getByText('admin')).toBeInTheDocument();
      // Khung Log live vẫn hiện cho ss_team thường.
      expect(screen.getByText(/Log live/i)).toBeInTheDocument();
    });
  });

  describe('Đổi nguồn -> reset category', () => {
    it('chọn nguồn khác thì category tự về option đầu tiên của nguồn đó', () => {
      render(<CrawlTrigger isAdmin sources={mockCrawlSources} initialRun={null} />);

      const sourceSelect = screen.getByLabelText(/Nguồn/i) as HTMLSelectElement;
      const categorySelect = screen.getByLabelText(/Ngành/i) as HTMLSelectElement;

      expect(sourceSelect.value).toBe('topcv');
      expect(categorySelect.value).toBe('data-analyst');

      fireEvent.change(sourceSelect, { target: { value: 'vietnamworks' } });

      expect(sourceSelect.value).toBe('vietnamworks');
      expect(categorySelect.value).toBe('software-engineering');
    });
  });

  describe('Khi chưa từng crawl', () => {
    it('hiện "Chưa từng crawl lần nào" và "Chưa có log nào"', () => {
      render(<CrawlTrigger isAdmin sources={mockCrawlSources} initialRun={null} />);

      expect(screen.getByText(/Chưa từng crawl lần nào/i)).toBeInTheDocument();
      expect(screen.getByText(/Chưa có log nào/i)).toBeInTheDocument();
    });
  });

  describe('Submit kích hoạt crawl', () => {
    it('gọi startCrawl với đúng payload và bắt đầu poll khi thành công', async () => {
      (startCrawl as jest.Mock).mockResolvedValue({ success: true, result: mockCrawlAccepted });
      (getCrawlStatus as jest.Mock).mockResolvedValue(mockCrawlStatus);
      (getCrawlLogs as jest.Mock).mockResolvedValue(mockCrawlLogsResponse);

      render(<CrawlTrigger isAdmin sources={mockCrawlSources} initialRun={null} />);

      fireEvent.change(screen.getByLabelText(/Số trang/i), { target: { value: '5' } });
      fireEvent.change(screen.getByLabelText(/Số JD tối đa/i), { target: { value: '100' } });
      fireEvent.click(screen.getByRole('button', { name: /Bắt đầu crawl/i }));

      await waitFor(() => {
        expect(startCrawl).toHaveBeenCalledWith({
          source: 'topcv',
          category: 'data-analyst',
          pages: 5,
          max_jobs: 100,
        });
      });

      // Sau khi có run_id, component tự pollOnce() ngay lập tức (không
      // cần đợi hết interval đầu tiên).
      await waitFor(() => {
        expect(getCrawlStatus).toHaveBeenCalledWith(mockCrawlAccepted.run_id);
      });
      await waitFor(() => {
        expect(screen.getByText(/Đã tải: 10/i)).toBeInTheDocument();
      });
    });

    it('hiện lỗi và không bắt đầu poll khi startCrawl thất bại', async () => {
      (startCrawl as jest.Mock).mockResolvedValue({ success: false, error: 'Nguồn đang crawl dở' });

      render(<CrawlTrigger isAdmin sources={mockCrawlSources} initialRun={null} />);
      fireEvent.click(screen.getByRole('button', { name: /Bắt đầu crawl/i }));

      await waitFor(() => {
        expect(screen.getByText('Nguồn đang crawl dở')).toBeInTheDocument();
      });
      expect(getCrawlStatus).not.toHaveBeenCalled();
    });
  });

  describe('BUG FIX — isRunActive chỉ khoá khi cùng nguồn', () => {
    it('lượt đang chạy ở nguồn khác -> vẫn cho đổi sang nguồn đó và submit lại bình thường', () => {
      const runningOnTopcv = { ...mockCrawlStatus, source: 'topcv', status: 'running' };
      render(<CrawlTrigger isAdmin sources={mockCrawlSources} initialRun={runningOnTopcv} />);

      // Đang chọn "topcv" (mặc định) trùng nguồn đang chạy -> khoá.
      expect(screen.getByRole('button', { name: /Đang có lượt chạy/i })).toBeDisabled();

      // Đổi sang "vietnamworks" (khác nguồn đang chạy) -> mở khoá lại.
      fireEvent.change(screen.getByLabelText(/Nguồn/i), { target: { value: 'vietnamworks' } });
      expect(screen.getByRole('button', { name: /Bắt đầu crawl/i })).not.toBeDisabled();
    });
  });

  describe('Polling dừng khi run kết thúc', () => {
    it('status chuyển sang "done" -> dừng poll và gọi router.refresh()', async () => {
      (startCrawl as jest.Mock).mockResolvedValue({ success: true, result: mockCrawlAccepted });
      (getCrawlStatus as jest.Mock).mockResolvedValue({ ...mockCrawlStatus, status: 'done', progress: null });
      (getCrawlLogs as jest.Mock).mockResolvedValue({ last_id: 0, items: [] });

      render(<CrawlTrigger isAdmin sources={mockCrawlSources} initialRun={null} />);
      fireEvent.click(screen.getByRole('button', { name: /Bắt đầu crawl/i }));

      await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));

      const callsBeforeAdvance = (getCrawlStatus as jest.Mock).mock.calls.length;
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      // Interval đã bị clearInterval() -> không gọi thêm lần nào nữa.
      expect((getCrawlStatus as jest.Mock).mock.calls.length).toBe(callsBeforeAdvance);
    });
  });
});
