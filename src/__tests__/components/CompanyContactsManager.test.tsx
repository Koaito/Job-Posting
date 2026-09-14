/**
 * Tests for CompanyContactsManager Component
 * Mục #7 (rà soát kiến trúc 09/2026) — component trước đây chưa có test nào.
 *
 * Bao phủ đúng phân chia lỗi B.1 Polish ghi trong docstring component:
 * - handleCreate (form nhiều field) -> formError INLINE, không toast.
 * - handleUpdateStatus/handleUnassign/handleDelete (nút bấm-xong-liền
 *   trên 1 dòng bảng) -> toast.error(), kể cả validate note bắt buộc
 *   phía CLIENT trước khi gọi action (handleUnassign/handleDelete chặn
 *   ngay nếu note rỗng, không gọi network — khác handleUpdateStatus để
 *   backend tự quyết).
 * - errorUpdateStatusNoteHint chỉ nối thêm khi lỗi backend KHÔNG đã có
 *   sẵn chữ "note" trong đó (tránh lặp gợi ý 2 lần).
 *
 * useToast() mock trực tiếp module (giống MessageThread.test.tsx) để
 * assert đúng message truyền vào toast.error().
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import CompanyContactsManager from '@/components/features/CompanyContactsManager';
import { createContact, updateContact, assignContact, deleteContact } from '@/app/actions/contacts';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { mockContact } from '../fixtures';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/app/actions/contacts', () => ({
  createContact: jest.fn(),
  updateContact: jest.fn(),
  assignContact: jest.fn(),
  deleteContact: jest.fn(),
}));

jest.mock('@/components/ui/toast/ToastProvider', () => ({
  useToast: jest.fn(),
}));

describe('CompanyContactsManager Component', () => {
  const mockRefresh = jest.fn();
  const mockToastError = jest.fn();
  const companyId = 'company-1';

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ refresh: mockRefresh });
    (useToast as jest.Mock).mockReturnValue({ success: jest.fn(), error: mockToastError });
  });

  describe('Trạng thái rỗng', () => {
    it('hiện emptyState khi công ty chưa có liên hệ nào', () => {
      render(<CompanyContactsManager companyId={companyId} initialContacts={[]} />);
      expect(screen.getByText(/Chưa có liên hệ HR nào cho công ty này/i)).toBeInTheDocument();
    });

    it('hiện bảng khi có sẵn liên hệ', () => {
      render(<CompanyContactsManager companyId={companyId} initialContacts={[mockContact]} />);
      expect(screen.getByText(mockContact.contact_name)).toBeInTheDocument();
      expect(screen.getByText(/Chưa liên hệ/i)).toBeInTheDocument(); // statusLabel('UNCONTACTED')
    });
  });

  describe('Thêm liên hệ mới (formError inline)', () => {
    it('bấm "+ Thêm liên hệ HR" -> hiện form, điền tên -> submit thành công thêm vào bảng', async () => {
      const newContact = { ...mockContact, contact_id: 'contact-2', contact_name: 'Trần Thị B' };
      (createContact as jest.Mock).mockResolvedValue({ success: true, contact: newContact });

      render(<CompanyContactsManager companyId={companyId} initialContacts={[]} />);
      fireEvent.click(screen.getByRole('button', { name: /Thêm liên hệ HR/i }));

      fireEvent.change(screen.getByLabelText(/Tên \*/i), { target: { value: 'Trần Thị B' } });
      fireEvent.click(screen.getByRole('button', { name: /^Thêm$/i }));

      await waitFor(() => {
        expect(createContact).toHaveBeenCalledWith(
          companyId,
          expect.objectContaining({ contact_name: 'Trần Thị B' })
        );
      });
      await waitFor(() => {
        expect(screen.getByText('Trần Thị B')).toBeInTheDocument();
      });
      expect(mockRefresh).toHaveBeenCalled();
      // Form đóng lại sau khi thêm thành công.
      expect(screen.queryByLabelText(/Tên \*/i)).not.toBeInTheDocument();
    });

    it('submit thất bại -> hiện formError INLINE, KHÔNG gọi toast.error()', async () => {
      (createContact as jest.Mock).mockResolvedValue({ success: false, error: 'Email không hợp lệ' });

      render(<CompanyContactsManager companyId={companyId} initialContacts={[]} />);
      fireEvent.click(screen.getByRole('button', { name: /Thêm liên hệ HR/i }));
      fireEvent.change(screen.getByLabelText(/Tên \*/i), { target: { value: 'X' } });
      fireEvent.click(screen.getByRole('button', { name: /^Thêm$/i }));

      await waitFor(() => {
        expect(screen.getByText('Email không hợp lệ')).toBeInTheDocument();
      });
      expect(mockToastError).not.toHaveBeenCalled();
    });

    it('bấm "Huỷ" đóng form không gọi action', () => {
      render(<CompanyContactsManager companyId={companyId} initialContacts={[]} />);
      fireEvent.click(screen.getByRole('button', { name: /Thêm liên hệ HR/i }));
      fireEvent.click(screen.getByRole('button', { name: /Huỷ/i }));

      expect(screen.queryByLabelText(/Tên \*/i)).not.toBeInTheDocument();
      expect(createContact).not.toHaveBeenCalled();
    });
  });

  describe('Đổi trạng thái liên hệ (toast.error)', () => {
    it('bấm "Sửa" -> chọn status khác -> updateContact() thành công cập nhật badge', async () => {
      const updated = { ...mockContact, contact_status: 'RESPONDED' };
      (updateContact as jest.Mock).mockResolvedValue({ success: true, contact: updated });

      render(<CompanyContactsManager companyId={companyId} initialContacts={[mockContact]} />);
      fireEvent.click(screen.getByRole('button', { name: /^Sửa$/i }));

      const select = screen.getByDisplayValue('Chưa liên hệ');
      fireEvent.change(select, { target: { value: 'RESPONDED' } });

      await waitFor(() => {
        expect(updateContact).toHaveBeenCalledWith(
          companyId,
          mockContact.contact_id,
          expect.objectContaining({ contact_status: 'RESPONDED' })
        );
      });
      await waitFor(() => {
        expect(screen.getByText(/Đã phản hồi/i)).toBeInTheDocument();
      });
    });

    it('backend từ chối vì thiếu note -> nối thêm errorUpdateStatusNoteHint', async () => {
      (updateContact as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Giá trị đã đổi, cần ghi chú lý do',
      });

      render(<CompanyContactsManager companyId={companyId} initialContacts={[mockContact]} />);
      fireEvent.click(screen.getByRole('button', { name: /^Sửa$/i }));
      fireEvent.change(screen.getByDisplayValue('Chưa liên hệ'), { target: { value: 'RESPONDED' } });

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          'Giá trị đã đổi, cần ghi chú lý do — nếu lỗi thiếu note, nhập lý do sửa ở ô bên cạnh rồi thử lại.'
        );
      });
    });

    it('lỗi backend đã có sẵn chữ "note" -> KHÔNG nối thêm hint (tránh lặp)', async () => {
      (updateContact as jest.Mock).mockResolvedValue({
        success: false,
        error: 'note là bắt buộc khi đổi giá trị',
      });

      render(<CompanyContactsManager companyId={companyId} initialContacts={[mockContact]} />);
      fireEvent.click(screen.getByRole('button', { name: /^Sửa$/i }));
      fireEvent.change(screen.getByDisplayValue('Chưa liên hệ'), { target: { value: 'RESPONDED' } });

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('note là bắt buộc khi đổi giá trị');
      });
    });
  });

  describe('Bỏ gán phụ trách — validate note phía CLIENT', () => {
    it('chưa nhập note -> toast.error() ngay, KHÔNG gọi assignContact()', () => {
      render(<CompanyContactsManager companyId={companyId} initialContacts={[mockContact]} />);
      fireEvent.click(screen.getByRole('button', { name: /^Sửa$/i }));
      fireEvent.click(screen.getByRole('button', { name: /Bỏ gán phụ trách/i }));

      expect(mockToastError).toHaveBeenCalledWith('Vui lòng nhập lý do bỏ gán ở ô note.');
      expect(assignContact).not.toHaveBeenCalled();
    });

    it('có note -> gọi assignContact() với assigned_ss_user=null', async () => {
      (assignContact as jest.Mock).mockResolvedValue({ success: true, contact: mockContact });

      render(<CompanyContactsManager companyId={companyId} initialContacts={[mockContact]} />);
      fireEvent.click(screen.getByRole('button', { name: /^Sửa$/i }));
      fireEvent.change(screen.getByPlaceholderText(/Lý do sửa/i), { target: { value: 'Nghỉ việc' } });
      fireEvent.click(screen.getByRole('button', { name: /Bỏ gán phụ trách/i }));

      await waitFor(() => {
        expect(assignContact).toHaveBeenCalledWith(companyId, mockContact.contact_id, {
          assigned_ss_user: null,
          note: 'Nghỉ việc',
        });
      });
    });
  });

  describe('Xoá liên hệ — validate note phía CLIENT', () => {
    it('chưa nhập lý do xoá -> toast.error() ngay, KHÔNG gọi deleteContact()', () => {
      render(<CompanyContactsManager companyId={companyId} initialContacts={[mockContact]} />);
      fireEvent.click(screen.getByRole('button', { name: /^Xoá$/i }));
      fireEvent.click(screen.getByRole('button', { name: /Xác nhận xoá/i }));

      expect(mockToastError).toHaveBeenCalledWith('Vui lòng nhập lý do xoá.');
      expect(deleteContact).not.toHaveBeenCalled();
    });

    it('có lý do -> xoá thành công gỡ dòng khỏi bảng + router.refresh()', async () => {
      (deleteContact as jest.Mock).mockResolvedValue({ success: true });

      render(<CompanyContactsManager companyId={companyId} initialContacts={[mockContact]} />);
      fireEvent.click(screen.getByRole('button', { name: /^Xoá$/i }));
      fireEvent.change(screen.getByPlaceholderText(/Lý do xoá/i), { target: { value: 'Trùng lặp' } });
      fireEvent.click(screen.getByRole('button', { name: /Xác nhận xoá/i }));

      await waitFor(() => {
        expect(deleteContact).toHaveBeenCalledWith(companyId, mockContact.contact_id, { note: 'Trùng lặp' });
      });
      await waitFor(() => {
        expect(screen.queryByText(mockContact.contact_name)).not.toBeInTheDocument();
      });
      expect(mockRefresh).toHaveBeenCalled();
    });

    it('xoá thất bại -> toast.error() với lỗi backend, dòng vẫn còn trong bảng', async () => {
      (deleteContact as jest.Mock).mockResolvedValue({ success: false, error: 'Không có quyền xoá' });

      render(<CompanyContactsManager companyId={companyId} initialContacts={[mockContact]} />);
      fireEvent.click(screen.getByRole('button', { name: /^Xoá$/i }));
      fireEvent.change(screen.getByPlaceholderText(/Lý do xoá/i), { target: { value: 'Trùng lặp' } });
      fireEvent.click(screen.getByRole('button', { name: /Xác nhận xoá/i }));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Không có quyền xoá');
      });
      expect(screen.getByText(mockContact.contact_name)).toBeInTheDocument();
    });
  });
});
