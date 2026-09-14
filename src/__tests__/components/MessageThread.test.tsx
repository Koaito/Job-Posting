/**
 * Tests for MessageThread Component
 * Mục #7 (rà soát kiến trúc 09/2026) — component trước đây chưa có test nào.
 *
 * Bao phủ đúng các nhánh B.1 Polish đã ghi trong docstring component:
 * - formError (inline, cạnh ô soạn) TÁCH RIÊNG khỏi toast.error() (dùng
 *   cho cancel/block/unblock) — 2 luồng lỗi test riêng để không lẫn.
 * - sendMessage(): rỗng nội dung chặn trước khi gọi action; 'sent' ->
 *   nối vào history; 'pending' -> alert() + router.refresh(), KHÔNG tự
 *   chèn tin giả vào khung chat (đúng comment trong component).
 * - showBlockControls / showCancelControl: điều kiện hiện nút theo
 *   role + trạng thái quan hệ + lịch sử rỗng hay không.
 * - Polling getMessagesSince() định kỳ, nối tin mới vào history.
 *
 * useToast() mock trực tiếp module (thay vì bọc <ToastProvider> thật)
 * để assert đúng lệnh gọi toast.error(...) với message cụ thể — cách
 * này cũng tránh phải quan tâm timing tự-ẩn AUTO_DISMISS_MS của toast
 * thật, không liên quan tới logic đang test ở đây.
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { MessageThread } from '@/components/features/MessageThread';
import {
  sendMessage,
  getMessagesSince,
  cancelPendingRequest,
  blockStudent,
  unblockRelationship,
} from '@/app/actions/messages';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { mockChatMessage } from '../fixtures';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/app/actions/messages', () => ({
  sendMessage: jest.fn(),
  getMessagesSince: jest.fn(),
  cancelPendingRequest: jest.fn(),
  blockStudent: jest.fn(),
  unblockRelationship: jest.fn(),
}));

jest.mock('@/components/ui/toast/ToastProvider', () => ({
  useToast: jest.fn(),
}));

const baseProps = {
  partnerId: 'partner-1',
  partnerName: 'Nguyễn Văn A',
  partnerRole: 'user',
  relationshipStatus: 'accepted',
  relationshipId: 'rel-1',
  initialHistory: [],
  lastId: 0,
  currentUserId: 'user-1',
  isStaff: true,
  isStudent: false,
  maxContentLength: 2000,
};

describe('MessageThread Component', () => {
  const mockPush = jest.fn();
  const mockRefresh = jest.fn();
  const mockToastError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush, refresh: mockRefresh });
    (useToast as jest.Mock).mockReturnValue({ success: jest.fn(), error: mockToastError });
    (getMessagesSince as jest.Mock).mockResolvedValue([]);
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    jest.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('Trạng thái rỗng', () => {
    it('hiện emptyStateStaff khi isStaff=true và chưa có tin nhắn', () => {
      render(<MessageThread {...baseProps} />);
      expect(
        screen.getByText(/Nhắn trước cho Nguyễn Văn A — hội thoại sẽ tự mở/i)
      ).toBeInTheDocument();
    });

    it('hiện emptyStateStudent khi isStudent=true và chưa có tin nhắn', () => {
      render(<MessageThread {...baseProps} isStaff={false} isStudent />);
      expect(screen.getByText(/Gửi tin đầu tiên bên dưới để tạo yêu cầu/i)).toBeInTheDocument();
    });

    it('hiện lịch sử có sẵn khi initialHistory không rỗng', () => {
      render(<MessageThread {...baseProps} initialHistory={[mockChatMessage]} lastId={1} />);
      expect(screen.getByText(mockChatMessage.content)).toBeInTheDocument();
    });
  });

  describe('Gửi tin nhắn', () => {
    it('chặn gửi và hiện lỗi inline khi nội dung rỗng, KHÔNG gọi sendMessage', () => {
      render(<MessageThread {...baseProps} />);
      // BUG FIX (mục #7b): textarea để trống hẳn có `required` (HTML5) —
      // jsdom tự chặn submit ở tầng native TRƯỚC KHI onSubmit của React
      // chạy, nên handleSend không bao giờ được gọi và formError không
      // bao giờ set (đúng hành vi trình duyệt thật, không phải bug).
      // Validation .trim() trong component chỉ thật sự chạy tới được
      // khi nội dung vượt qua required (có ký tự) nhưng vẫn rỗng sau
      // khi trim — tức là chuỗi toàn khoảng trắng.
      const textarea = screen.getByPlaceholderText(/Nhập tin nhắn/i);
      fireEvent.change(textarea, { target: { value: '   ' } });
      fireEvent.click(screen.getByRole('button', { name: /^Gửi$/i }));

      expect(screen.getByText(/Vui lòng nhập nội dung tin nhắn/i)).toBeInTheDocument();
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('gửi thành công (status=sent) -> nối tin vào history, xoá nội dung ô soạn', async () => {
      (sendMessage as jest.Mock).mockResolvedValue({
        success: true,
        status: 'sent',
        message: { ...mockChatMessage, id: 99, content: 'Chào bạn nhé' },
      });

      render(<MessageThread {...baseProps} />);
      const textarea = screen.getByPlaceholderText(/Nhập tin nhắn/i);
      fireEvent.change(textarea, { target: { value: 'Chào bạn nhé' } });
      fireEvent.click(screen.getByRole('button', { name: /^Gửi$/i }));

      await waitFor(() => {
        expect(sendMessage).toHaveBeenCalledWith('partner-1', 'Chào bạn nhé');
      });
      await waitFor(() => {
        expect(screen.getByText('Chào bạn nhé')).toBeInTheDocument();
      });
      // BUG FIX (mục #7b): setContent('') chạy cùng lượt render với
      // setHistory/setLastMessageId (cùng trong handleSend sau await
      // sendMessage) nhưng không đảm bảo đã commit ngay tại thời điểm
      // assertion phía trên chạy xong — bọc trong waitFor để tránh đọc
      // textarea.value không đúng nhịp render.
      await waitFor(() => {
        expect((textarea as HTMLTextAreaElement).value).toBe('');
      });
    });

    it('gửi thành công (status=pending) -> alert() + router.refresh(), KHÔNG chèn tin giả', async () => {
      (sendMessage as jest.Mock).mockResolvedValue({
        success: true,
        status: 'pending',
        message: 'Đã gửi yêu cầu nhắn tin, chờ SS chấp nhận.',
      });

      render(<MessageThread {...baseProps} isStaff={false} isStudent relationshipStatus={null} />);
      const textarea = screen.getByPlaceholderText(/Nhập tin nhắn/i);
      fireEvent.change(textarea, { target: { value: 'Xin chào' } });
      fireEvent.click(screen.getByRole('button', { name: /^Gửi$/i }));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Đã gửi yêu cầu nhắn tin, chờ SS chấp nhận.');
      });
      expect(mockRefresh).toHaveBeenCalled();
      // Không có bong bóng tin nhắn nào được thêm vào khung chat.
      expect(screen.queryByText('Xin chào')).not.toBeInTheDocument();
    });

    it('gửi thất bại -> hiện lỗi backend inline, giữ nguyên nội dung đã gõ', async () => {
      (sendMessage as jest.Mock).mockResolvedValue({ success: false, error: 'Bạn đã bị chặn.' });

      render(<MessageThread {...baseProps} />);
      const textarea = screen.getByPlaceholderText(/Nhập tin nhắn/i);
      fireEvent.change(textarea, { target: { value: 'Test' } });
      fireEvent.click(screen.getByRole('button', { name: /^Gửi$/i }));

      await waitFor(() => {
        expect(screen.getByText('Bạn đã bị chặn.')).toBeInTheDocument();
      });
      expect((textarea as HTMLTextAreaElement).value).toBe('Test');
    });
  });

  describe('Huỷ yêu cầu đang chờ (học viên)', () => {
    const cancelProps = {
      ...baseProps,
      isStaff: false,
      isStudent: true,
      partnerRole: 'ss_team',
      initialHistory: [],
    };

    it('hiện nút huỷ khi isStudent, chưa có lịch sử, và partner là staff', () => {
      render(<MessageThread {...cancelProps} />);
      expect(screen.getByRole('button', { name: /Huỷ yêu cầu đang chờ/i })).toBeInTheDocument();
    });

    it('không hiện nút huỷ nếu đã có lịch sử tin nhắn', () => {
      render(<MessageThread {...cancelProps} initialHistory={[mockChatMessage]} />);
      expect(screen.queryByRole('button', { name: /Huỷ yêu cầu đang chờ/i })).not.toBeInTheDocument();
    });

    it('bấm huỷ -> confirm() -> cancelPendingRequest() thành công -> điều hướng về /messages', async () => {
      (cancelPendingRequest as jest.Mock).mockResolvedValue({ success: true });
      render(<MessageThread {...cancelProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Huỷ yêu cầu đang chờ/i }));

      expect(window.confirm).toHaveBeenCalled();
      await waitFor(() => expect(cancelPendingRequest).toHaveBeenCalledWith('partner-1'));
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/messages'));
    });

    it('huỷ thất bại -> gọi toast.error() với lỗi backend', async () => {
      (cancelPendingRequest as jest.Mock).mockResolvedValue({ success: false, error: 'Không thể huỷ lúc này' });
      render(<MessageThread {...cancelProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Huỷ yêu cầu đang chờ/i }));

      await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Không thể huỷ lúc này'));
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('confirm() trả false -> không gọi action nào', () => {
      (window.confirm as jest.Mock).mockReturnValue(false);
      render(<MessageThread {...cancelProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Huỷ yêu cầu đang chờ/i }));

      expect(cancelPendingRequest).not.toHaveBeenCalled();
    });
  });

  describe('Chặn / bỏ chặn học viên (staff)', () => {
    it('hiện nút "Chặn học viên" khi isStaff, partner là user, chưa bị chặn', () => {
      render(<MessageThread {...baseProps} />);
      expect(screen.getByRole('button', { name: /Chặn học viên/i })).toBeInTheDocument();
    });

    it('không hiện nút chặn nếu partner không phải role user', () => {
      render(<MessageThread {...baseProps} partnerRole="ss_team" />);
      expect(screen.queryByRole('button', { name: /Chặn học viên/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Bỏ chặn học viên/i })).not.toBeInTheDocument();
    });

    it('bấm "Chặn học viên" -> blockStudent() thành công -> router.refresh()', async () => {
      (blockStudent as jest.Mock).mockResolvedValue({ success: true });
      render(<MessageThread {...baseProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Chặn học viên/i }));

      await waitFor(() => expect(blockStudent).toHaveBeenCalledWith('partner-1'));
      await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    });

    it('relationshipStatus=blocked -> hiện nút "Bỏ chặn học viên", bấm gọi unblockRelationship()', async () => {
      (unblockRelationship as jest.Mock).mockResolvedValue({ success: true });
      render(<MessageThread {...baseProps} relationshipStatus="blocked" relationshipId="rel-1" />);

      const unblockBtn = screen.getByRole('button', { name: /Bỏ chặn học viên/i });
      fireEvent.click(unblockBtn);

      await waitFor(() => expect(unblockRelationship).toHaveBeenCalledWith('rel-1'));
      await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    });

    it('chặn thất bại -> toast.error() với fallback khi backend không trả error', async () => {
      (blockStudent as jest.Mock).mockResolvedValue({ success: false });
      render(<MessageThread {...baseProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Chặn học viên/i }));

      await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Không thể chặn học viên'));
    });
  });

  describe('Polling tin nhắn mới', () => {
    it('mỗi 5s gọi getMessagesSince() và nối tin mới vào history', async () => {
      (getMessagesSince as jest.Mock).mockResolvedValueOnce([
        { ...mockChatMessage, id: 2, content: 'Tin mới nhất' },
      ]);

      render(<MessageThread {...baseProps} lastId={1} />);

      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(getMessagesSince).toHaveBeenCalledWith('partner-1', 1);
      });
      expect(screen.getByText('Tin mới nhất')).toBeInTheDocument();
    });
  });
});
