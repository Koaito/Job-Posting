/**
 * Tests for Import/Export Server Actions (Phase 6.3, 09/2026)
 * Backend thật: Scrap_JD/api/routers/import_export.py
 *
 * Trọng tâm test: đây là module có 2 "hành vi mặc định nguy hiểm" đã
 * được xác nhận trực tiếp từ api/services/import_executor.py (xem
 * docstring đầu actions/import-export.ts):
 *   1. Dòng "no_conflict" + needs_level_resolve=true — backend LUÔN tạo
 *      dòng bất kể resolution, chỉ chặn level_code=NULL nếu action gửi
 *      lên KHÁC "skip". FE phải tự đảm bảo không bao giờ để lọt qua mà
 *      không có resolution tường minh.
 *   2. Dòng "pending_company_resolution" — action="skip" KHÔNG đảm bảo
 *      bị bỏ qua nếu backend không tái phát hiện conflict sau khi tự
 *      resolve company theo tên trong file.
 * File test này không thể gọi thẳng logic Python để verify 2 case trên
 * (đó là việc của test phía backend/Scrap_JD), nhưng test được ĐÚNG THỨ
 * mà actions/import-export.ts + ImportPanel.tsx chịu trách nhiệm: gọi
 * đúng URL/method/body cho từng route resolve, và xử lý đúng các mã lỗi
 * đặc biệt (429 upload rate limit, 410 preview hết hạn, 422 file bị từ
 * chối nguyên khối kèm fileErrors).
 */

import {
  getExportPreview,
  exportEntity,
  uploadImportFile,
  getImportPreview,
  verifyField,
  resolveCompany,
  confirmImport,
} from '@/app/actions/import-export';
import {
  mockExportPreviewResult,
  mockImportPreviewResult,
  mockImportRowNoConflict,
  mockImportRowNeedsLevelResolve,
  mockImportConfirmSummary,
  mockFetchSuccess,
  mockFetchError,
  mockFetchStatus,
  mockFetchNetworkError,
  mockFetchFile,
} from '../fixtures';

global.fetch = jest.fn();

const mockCookieGet = jest.fn();
jest.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get: mockCookieGet }),
}));

describe('import-export.ts Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCookieGet.mockImplementation((name: string) =>
      name === 'access_token' ? { value: 'mock-access-token' } : undefined
    );
  });

  // ------------------------------------------------------------------
  // Export
  // ------------------------------------------------------------------

  describe('getExportPreview()', () => {
    it('should gọi đúng URL kèm query params filter', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockExportPreviewResult));

      const result = await getExportPreview('job', { status: 'OPEN', from_date: '2026-01-01' });

      expect(result.success).toBe(true);
      expect(result.preview?.total_matching).toBe(42);
      const [url] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toContain('/export/job/preview?');
      expect(url).toContain('status=OPEN');
      expect(url).toContain('from_date=2026-01-01');
    });

    it('should KHÔNG gửi is_active nếu undefined (tránh backend 400 cho entity job)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockExportPreviewResult));

      await getExportPreview('job', { status: 'OPEN' });

      const [url] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).not.toContain('is_active');
    });

    it('should trả lỗi rõ ràng khi backend trả 400', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchError(400, 'Bad request'));

      const result = await getExportPreview('company', { is_active: true });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should xử lý network error', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchNetworkError());

      const result = await getExportPreview('job');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('exportEntity()', () => {
    it('should trả về base64 + filename lấy từ Content-Disposition', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchFile({
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          filename: 'jobs_export_2026-09-05.xlsx',
          bytes: 'fake-xlsx-bytes',
        })
      );

      const result = await exportEntity('job', 'xlsx', { status: 'OPEN' });

      expect(result.success).toBe(true);
      expect(result.filename).toBe('jobs_export_2026-09-05.xlsx');
      expect(result.contentType).toContain('spreadsheetml');
      expect(result.base64).toBe(Buffer.from('fake-xlsx-bytes').toString('base64'));
      const [url] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toContain('format=xlsx');
    });

    it('should tự đặt tên file mặc định nếu backend không trả Content-Disposition', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchFile({}));

      const result = await exportEntity('company', 'csv');

      expect(result.success).toBe(true);
      expect(result.filename).toBe('company_export.csv');
    });

    it('should trả lỗi nếu backend từ chối export', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchError(403, 'Forbidden'));

      const result = await exportEntity('contact', 'csv');

      expect(result.success).toBe(false);
    });
  });

  // ------------------------------------------------------------------
  // Import — upload + preview
  // ------------------------------------------------------------------

  describe('uploadImportFile()', () => {
    const makeCsvFile = () => new File(['job_title,company_id\n'], 'jobs.csv', { type: 'text/csv' });

    it('should POST multipart/form-data KHÔNG tự set Content-Type', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockImportPreviewResult));

      const result = await uploadImportFile('job', makeCsvFile());

      expect(result.success).toBe(true);
      expect(result.preview?.preview_id).toBe('preview-abc-123');
      const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toContain('/import/job/preview');
      expect(options.method).toBe('POST');
      expect(options.body).toBeInstanceOf(FormData);
      // Multipart: KHÔNG set Content-Type thủ công (để fetch tự sinh boundary).
      expect(options.headers['Content-Type']).toBeUndefined();
      // Vẫn phải có X-API-Key + Authorization như mọi request khác.
      expect(options.headers['X-API-Key']).toBe('test-api-key');
      expect(options.headers['Authorization']).toBe('Bearer mock-access-token');
    });

    it('should báo rõ giới hạn rate limit khi backend trả 429', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchStatus(429));

      const result = await uploadImportFile('job', makeCsvFile());

      expect(result.success).toBe(false);
      expect(result.error).toContain('20 lần/giờ');
    });

    it('should trả kèm fileErrors khi backend reject cả file (422 dạng {message, errors})', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchStatus(422, {
          detail: {
            message: 'File có 2 dòng không hợp lệ',
            errors: [
              { row_number: 3, field_name: 'salary_min', rule: 'type_number', message: 'Không phải số' },
              { row_number: 7, field_name: 'job_title', rule: 'required', message: 'Bắt buộc' },
            ],
          },
        })
      );

      const result = await uploadImportFile('job', makeCsvFile());

      expect(result.success).toBe(false);
      expect(result.error).toBe('File có 2 dòng không hợp lệ');
      expect(result.fileErrors).toHaveLength(2);
      expect(result.fileErrors?.[0].field_name).toBe('salary_min');
    });

    it('should gộp message từ lỗi 422 dạng Pydantic (array of {msg})', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchStatus(422, { detail: [{ msg: 'field required' }, { msg: 'invalid type' }] })
      );

      const result = await uploadImportFile('company', makeCsvFile());

      expect(result.success).toBe(false);
      expect(result.error).toBe('field required; invalid type');
      expect(result.fileErrors).toBeUndefined();
    });
  });

  describe('getImportPreview()', () => {
    it('should trả preview theo preview_id', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockImportPreviewResult));

      const result = await getImportPreview('job', 'preview-abc-123');

      expect(result.success).toBe(true);
      expect(result.preview?.rows).toHaveLength(4);
      const [url] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe(
        `${process.env.FASTAPI_URL}/import/job/preview/preview-abc-123`
      );
    });

    it('should báo expired=true riêng biệt khi backend trả 410 (khác preview không tồn tại)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchStatus(410));

      const result = await getImportPreview('job', 'preview-old');

      expect(result.success).toBe(false);
      expect(result.expired).toBe(true);
      expect(result.error).toContain('1 giờ');
    });

    it('should KHÔNG set expired khi lỗi là 404 (preview không tồn tại/không thuộc về mình)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchError(404, 'Not found'));

      const result = await getImportPreview('job', 'preview-khong-ton-tai');

      expect(result.success).toBe(false);
      expect(result.expired).toBeUndefined();
    });
  });

  // ------------------------------------------------------------------
  // Import — resolve tại chỗ (đúng 3 route mới bổ sung ở đợt 2)
  //
  // DỌN DEAD CODE (rà soát #3, 09/2026): đã xoá describe('getCompanySuggestions()')
  // — hàm tương ứng không nơi nào gọi thật, xem docstring
  // actions/import-export.ts + mục 6.10 plan_nextjs.md.
  // ------------------------------------------------------------------

  describe('verifyField()', () => {
    it('should trả row đã cập nhật + fieldError=null khi sửa hợp lệ', async () => {
      const updatedRow = { ...mockImportRowNeedsLevelResolve, needs_level_resolve: false };
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchSuccess({ row: updatedRow, field_error: null })
      );

      const result = await verifyField('job', 'preview-abc-123', 1, 'level_code', 'Senior');

      expect(result.success).toBe(true);
      expect(result.fieldError).toBeNull();
      expect(result.row?.needs_level_resolve).toBe(false);
      const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe(
        `${process.env.FASTAPI_URL}/import/job/preview/preview-abc-123/rows/1/verify-field`
      );
      expect(JSON.parse(options.body)).toEqual({ field_name: 'level_code', value: 'Senior' });
    });

    it('should trả fieldError (không phải undefined) khi vẫn còn sai — component phải giữ nguyên state cũ', async () => {
      const fieldError = {
        rule: 'business_rule_enum' as const,
        message: 'Không nằm trong danh sách hợp lệ',
        raw_value: 'Junior Senior',
        widget_type: 'enum' as const,
        options: ['Intern', 'Fresher', 'Junior', 'Middle', 'Senior'],
      };
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchSuccess({ row: undefined, field_error: fieldError })
      );

      const result = await verifyField('job', 'preview-abc-123', 1, 'level_code', 'Junior Senior');

      expect(result.success).toBe(true);
      expect(result.fieldError).toEqual(fieldError);
      expect(result.row).toBeUndefined();
    });
  });

  describe('resolveCompany()', () => {
    it('should gửi company_id đã chọn và trả lại row sau re-check conflict', async () => {
      const resolvedRow = {
        ...mockImportRowNoConflict,
        row_index: 2,
        conflict_status: 'no_conflict' as const,
        company_resolution: {
          status: 'resolved' as const,
          company_id: 'company-9',
          company_is_active: true,
          suggestions: [],
        },
      };
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess({ row: resolvedRow }));

      const result = await resolveCompany('job', 'preview-abc-123', 2, 'company-9');

      expect(result.success).toBe(true);
      expect(result.row?.conflict_status).toBe('no_conflict');
      const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe(
        `${process.env.FASTAPI_URL}/import/job/preview/preview-abc-123/rows/2/resolve-company`
      );
      expect(JSON.parse(options.body)).toEqual({ company_id: 'company-9' });
    });

    it('should gửi company_id=null khi staff chọn "Tạo công ty mới theo tên trong file"', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchSuccess({ row: { ...mockImportRowNoConflict, row_index: 2 } })
      );

      await resolveCompany('job', 'preview-abc-123', 2, null);

      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(JSON.parse(options.body)).toEqual({ company_id: null });
    });
  });

  // ------------------------------------------------------------------
  // Import — confirm
  // ------------------------------------------------------------------

  describe('confirmImport()', () => {
    it('should gửi đúng preview_id + note + resolutions map theo key row_index dạng string', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockImportConfirmSummary));

      const resolutions = {
        '1': { action: 'create' as const, level_code: 'Senior' },
        '3': { action: 'skip' as const },
      };
      const result = await confirmImport('job', 'preview-abc-123', resolutions, 'Import batch tháng 9');

      expect(result.success).toBe(true);
      expect(result.result?.created).toBe(2);
      const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe(`${process.env.FASTAPI_URL}/import/job/confirm`);
      expect(JSON.parse(options.body)).toEqual({
        preview_id: 'preview-abc-123',
        note: 'Import batch tháng 9',
        resolutions,
      });
    });

    it('should trả lỗi 422 nếu thiếu resolution cho dòng conflict_in_batch (backend rollback sạch)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchStatus(422, { detail: 'Thiếu resolution cho dòng conflict_in_batch: row 3' })
      );

      const result = await confirmImport('job', 'preview-abc-123', {}, 'note');

      expect(result.success).toBe(false);
      expect(result.error).toContain('conflict_in_batch');
    });

    it('should xử lý network error khi confirm (không throw ra ngoài Server Action)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchNetworkError());

      const result = await confirmImport('job', 'preview-abc-123', {}, 'note');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });
});
