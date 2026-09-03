/**
 * Tests for Companies Server Actions
 * Matches Flask: blueprints/companies.py pattern
 */

import {
  getCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
} from '@/app/actions/companies';
import {
  mockCompany,
  mockCompanyDetail,
  mockCompaniesResponse,
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

describe('Companies Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCookieGet.mockImplementation((name: string) =>
      name === 'access_token' ? { value: 'mock-access-token' } : undefined
    );
  });

  describe('getCompanies()', () => {
    it('should fetch companies with default pagination', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockCompaniesResponse));

      const result = await getCompanies();

      // GET /companies là route public — CHỈ cần X-API-Key, KHÔNG có
      // Authorization (khác companies.ts::getAuthHeaders() dùng cho
      // create/update/delete bên dưới).
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/companies?limit=50&offset=0'),
        expect.objectContaining({ headers: { 'X-API-Key': 'test-api-key' } })
      );
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should build query params đúng field thật (keyword/province/has_social)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockCompaniesResponse));

      await getCompanies({ keyword: 'ACME', province: 'Hồ Chí Minh', has_social: true });

      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('keyword=ACME');
      expect(calledUrl).toContain('province=');
      expect(calledUrl).toContain('has_social=true');
    });

    it('should return empty paginated result on backend error', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchError(500, 'Internal Server Error'));
      const result = await getCompanies();
      expect(result).toEqual({ items: [], total: 0, limit: 50, offset: 0 });
    });

    it('should return empty paginated result on network error, giữ đúng limit/offset đã truyền', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchNetworkError());
      const result = await getCompanies({ limit: 20, offset: 40 });
      expect(result).toEqual({ items: [], total: 0, limit: 20, offset: 40 });
    });
  });

  describe('getCompanyById()', () => {
    it('should fetch company detail kèm jobs', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockCompanyDetail));
      const result = await getCompanyById('company-1');
      expect(result?.company_id).toBe('company-1');
      expect(result?.jobs).toEqual([]);
    });

    it('should return null on 404, KHÔNG log như lỗi thật', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchError(404, 'Not Found'));

      const result = await getCompanyById('missing');

      expect(result).toBeNull();
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should return null and log on 500 (lỗi thật, khác 404)', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchError(500, 'Internal Server Error'));

      const result = await getCompanyById('company-1');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('createCompany()', () => {
    it('should POST với Authorization header và trả company khi thành công', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchStatus(201, mockCompany));

      const result = await createCompany({ company_name: 'ACME Corp' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/companies'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer mock-access-token' }),
        })
      );
      expect(result.success).toBe(true);
      expect(result.company?.company_name).toBe('ACME Corp');
    });

    it('should trả lỗi khi thiếu company_name (422)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchStatus(422, { detail: [{ msg: 'field required', loc: ['company_name'] }] })
      );
      const result = await createCompany({ company_name: '' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('field required');
    });

    it('should trả success:false khi network error', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchNetworkError());
      const result = await createCompany({ company_name: 'ACME Corp' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('updateCompany()', () => {
    it('should PATCH và trả company đã cập nhật', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchSuccess({ ...mockCompanyDetail, partnership_potential: 'MEDIUM' })
      );

      const result = await updateCompany('company-1', { partnership_potential: 'MEDIUM' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/companies/company-1'),
        expect.objectContaining({ method: 'PATCH' })
      );
      expect(result.success).toBe(true);
      expect(result.company?.partnership_potential).toBe('MEDIUM');
    });

    it('should trả lỗi khi backend từ chối (404 company không tồn tại)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchError(404, 'Company not found'));
      const result = await updateCompany('missing', { company_name: 'X' });
      expect(result.success).toBe(false);
    });
  });

  describe('deleteCompany()', () => {
    it('should DELETE kèm note bắt buộc trong body', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchStatus(204));

      const result = await deleteCompany('company-1', { note: 'Công ty ngừng hoạt động' });

      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(options.method).toBe('DELETE');
      expect(JSON.parse(options.body)).toEqual({ note: 'Công ty ngừng hoạt động' });
      expect(result.success).toBe(true);
    });

    it('204 KHÔNG có body — vẫn phải coi là thành công (khác 404/500)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchStatus(204));
      const result = await deleteCompany('company-1', { note: 'test' });
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should trả lỗi khi thiếu note (422 — backend chặn cứng)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchStatus(422, { detail: [{ msg: 'note is required' }] })
      );
      const result = await deleteCompany('company-1', { note: '' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('note is required');
    });
  });
});
