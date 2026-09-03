/**
 * Tests for Contacts (HR contact) Server Actions
 * Matches Flask: blueprints/contacts.py pattern
 */

import {
  getContacts,
  getContactsByCompany,
  createContact,
  updateContact,
  assignContact,
  deleteContact,
  hardDeleteContact,
} from '@/app/actions/contacts';
import {
  mockContact,
  mockContactsResponse,
  mockFetchSuccess,
  mockFetchError,
  mockFetchStatus,
  mockFetchNetworkError,
} from '../fixtures';

global.fetch = jest.fn();

const mockCookieGet = jest.fn();
jest.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get: mockCookieGet }),
}));

describe('Contacts Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCookieGet.mockImplementation((name: string) =>
      name === 'access_token' ? { value: 'mock-access-token' } : undefined
    );
  });

  describe('getContacts()', () => {
    it('should GET /contacts (KHÔNG lồng company_id trong path)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockContactsResponse));

      const result = await getContacts();

      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toMatch(/\/contacts\?/);
      expect(calledUrl).not.toContain('/companies/');
      expect(result.items[0].company_name).toBe('ACME Corp');
    });

    it('should dùng đúng param "search" (KHÔNG PHẢI "keyword")', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockContactsResponse));
      await getContacts({ search: 'HR' });
      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('search=HR');
      expect(calledUrl).not.toContain('keyword=');
    });

    it('should return empty paginated result on error', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchError(500, 'Internal Server Error'));
      expect(await getContacts()).toEqual({ total: 0, limit: 50, offset: 0, items: [] });
    });
  });

  describe('getContactsByCompany()', () => {
    it('should GET /companies/{id}/contacts (lồng company_id)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess([mockContact]));

      const result = await getContactsByCompany('company-1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/companies/company-1/contacts'),
        expect.any(Object)
      );
      expect(result).toHaveLength(1);
    });

    it('should return empty array on error', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchNetworkError());
      expect(await getContactsByCompany('company-1')).toEqual([]);
    });
  });

  describe('createContact()', () => {
    it('should POST và chỉ cần contact_name (note tuỳ chọn)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchStatus(201, mockContact));

      const result = await createContact('company-1', { contact_name: 'Nguyễn Văn HR' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/companies/company-1/contacts'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer mock-access-token' }),
        })
      );
      expect(result.success).toBe(true);
      expect(result.contact?.contact_name).toBe('Nguyễn Văn HR');
    });

    it('should trả lỗi 422 khi thiếu contact_name', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchStatus(422, { detail: [{ msg: 'contact_name is required' }] })
      );
      const result = await createContact('company-1', { contact_name: '' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('contact_name is required');
    });
  });

  describe('updateContact()', () => {
    it('should PATCH /companies/{id}/contacts/{contactId}', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchSuccess({ ...mockContact, contact_status: 'RESPONDED' })
      );

      const result = await updateContact('company-1', 'contact-1', {
        contact_status: 'RESPONDED',
        note: 'Đã phản hồi qua email',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/companies/company-1/contacts/contact-1'),
        expect.objectContaining({ method: 'PATCH' })
      );
      expect(result.success).toBe(true);
      expect(result.contact?.contact_status).toBe('RESPONDED');
    });

    it('should trả lỗi 422 khi đổi field mà THIẾU note (backend chặn cứng)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchStatus(422, { detail: [{ msg: 'note is required when a field changes' }] })
      );
      const result = await updateContact('company-1', 'contact-1', { contact_status: 'RESPONDED' });
      expect(result.success).toBe(false);
    });
  });

  describe('assignContact()', () => {
    it('should PATCH route RIÊNG /assign (khác updateContact)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchSuccess({ ...mockContact, assigned_ss_user: 'user-2' })
      );

      const result = await assignContact('company-1', 'contact-1', {
        assigned_ss_user: 'user-2',
        note: 'Gán phụ trách',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/companies/company-1/contacts/contact-1/assign'),
        expect.objectContaining({ method: 'PATCH' })
      );
      expect(result.success).toBe(true);
      expect(result.contact?.assigned_ss_user).toBe('user-2');
    });

    it('should cho phép assigned_ss_user: null (bỏ gán)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchSuccess({ ...mockContact, assigned_ss_user: null })
      );

      await assignContact('company-1', 'contact-1', { assigned_ss_user: null, note: 'Bỏ gán' });

      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(options.body);
      // assigned_ss_user PHẢI có mặt trong body dù giá trị null — phân
      // biệt với "không gửi field" (xem docstring assignContact()).
      expect(body).toHaveProperty('assigned_ss_user', null);
    });
  });

  describe('deleteContact() (soft delete)', () => {
    it('should DELETE kèm note bắt buộc trong body', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchStatus(204));

      const result = await deleteContact('company-1', 'contact-1', { note: 'Ngừng liên hệ' });

      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(options.method).toBe('DELETE');
      expect(JSON.parse(options.body)).toEqual({ note: 'Ngừng liên hệ' });
      expect(result.success).toBe(true);
    });

    it('should trả lỗi 422 khi thiếu note', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchStatus(422, { detail: [{ msg: 'note is required' }] })
      );
      const result = await deleteContact('company-1', 'contact-1', { note: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('hardDeleteContact()', () => {
    it('should DELETE route /hard, KHÔNG cần body', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchStatus(204));

      const result = await hardDeleteContact('company-1', 'contact-1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/companies/company-1/contacts/contact-1/hard'),
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(result.success).toBe(true);
    });

    it('409: chưa soft-delete trước đó (backend ép đi đúng luồng 2 bước)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchStatus(409, { detail: 'Contact must be soft-deleted first' })
      );
      const result = await hardDeleteContact('company-1', 'contact-1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('soft-deleted first');
    });

    it('409: còn job_contact_links (ràng buộc lịch sử với job)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchStatus(409, { detail: 'Contact still linked to job postings' })
      );
      const result = await hardDeleteContact('company-1', 'contact-1');
      expect(result.success).toBe(false);
    });
  });
});
