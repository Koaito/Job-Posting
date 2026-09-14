/**
 * Tests for ImportPanel Component (+ import-panel/* tách ra ở mục #8)
 * Mục #7 (rà soát kiến trúc 09/2026) — component trước đây chưa có test
 * nào, kể cả trước khi tách nhỏ ở #8.
 *
 * Test Ở MỨC INTEGRATION qua chính <ImportPanel>: KHÔNG mock
 * UploadStep/ImportRowRow/CompanyResolutionModal/ImportDoneCard — đây
 * là những mảnh orchestrator thật sự render ra, tách theo BƯỚC chứ
 * không phải theo trách nhiệm độc lập (state vẫn do ImportPanel nắm),
 * nên mock rời từng mảnh sẽ không test được đúng luồng dữ liệu 2 chiều
 * (buildResolutions() cần đọc lại state của MỌI dòng cùng lúc, xem
 * docstring ImportPanel.tsx).
 *
 * Bao phủ:
 * - Bước 1 (UploadStep): chọn file -> uploadImportFile() -> chuyển
 *   sang bảng preview khi thành công, hiện lỗi + fileErrors khi thất bại.
 * - Dòng no_conflict -> không cần resolution, confirm gửi resolutions
 *   rỗng cho các dòng đó.
 * - Dòng pending_company_resolution -> KHOÁ nút "Xác nhận import" (đúng
 *   comment trong component: case này KHÔNG có lựa chọn "bỏ qua an
 *   toàn"), mở modal, chọn gợi ý -> resolveCompany() -> row cập nhật,
 *   confirm được mở khoá lại.
 * - Dòng needs_field_fix -> sửa tại ô, verifyField() thành công ->
 *   refreshPreview() (getImportPreview) tải lại toàn bộ preview.
 * - Dòng conflict/conflict_inactive -> chọn radio Ghi đè, riêng
 *   conflict_inactive cần thêm xác nhận "kích hoạt lại" mới đưa
 *   confirm_reactivate=true vào resolution.
 * - Dòng conflict_in_batch chưa chọn hành động -> KHOÁ confirm
 *   (blockedMissingBatch).
 * - Xác nhận import thành công -> hiện ImportDoneCard, bấm "Import file
 *   khác" -> quay lại UploadStep (resetAll()).
 * - Thiếu ghi chú lúc confirm -> chặn, hiện noteRequired.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImportPanel from '@/components/features/data-management/ImportPanel';
import {
  uploadImportFile,
  getImportPreview,
  verifyField,
  resolveCompany,
  confirmImport,
} from '@/app/actions/import-export';
import type { ImportPreviewResult, ImportPreviewRow } from '@/types/import-export';

jest.mock('@/app/actions/import-export', () => ({
  uploadImportFile: jest.fn(),
  getImportPreview: jest.fn(),
  verifyField: jest.fn(),
  resolveCompany: jest.fn(),
  confirmImport: jest.fn(),
}));

function makeRow(overrides: Partial<ImportPreviewRow> & { row_index: number }): ImportPreviewRow {
  return {
    data: { job_title: 'Backend Dev', company_name: 'ACME', level_code: 'Middle', deadline: '2026-12-31' },
    conflict_status: 'no_conflict',
    existing_record: null,
    duplicate_match: null,
    duplicate_in_batch: null,
    needs_field_fix: false,
    field_errors: {},
    ...overrides,
  };
}

function makePreview(rows: ImportPreviewRow[], overrides: Partial<ImportPreviewResult['summary']> = {}): ImportPreviewResult {
  return {
    preview_id: 'preview-1',
    entity_type: 'job',
    summary: {
      total_rows: rows.length,
      new_records: rows.filter((r) => r.conflict_status === 'no_conflict').length,
      conflicts: rows.filter((r) => r.conflict_status === 'conflict').length,
      conflicts_inactive: rows.filter((r) => r.conflict_status === 'conflict_inactive').length,
      pending_company_resolution: rows.filter((r) => r.conflict_status === 'pending_company_resolution').length,
      conflicts_in_batch: rows.filter((r) => r.conflict_status === 'conflict_in_batch').length,
      pending_level_resolution: rows.filter((r) => r.needs_level_resolve).length,
      pending_field_fix: rows.filter((r) => r.needs_field_fix).length,
      id_field: 'job_id',
      ...overrides,
    },
    rows,
  };
}

async function fillNoteAndConfirm() {
  fireEvent.change(screen.getByPlaceholderText(/Bắt buộc — lưu vào audit log/i), {
    target: { value: 'Import job từ đợt crawl tháng 9' },
  });
  fireEvent.click(screen.getByRole('button', { name: /Xác nhận import/i }));
}

describe('ImportPanel Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Bước 1 — Upload file', () => {
    it('chọn file, upload thành công -> chuyển sang bảng preview', async () => {
      const preview = makePreview([makeRow({ row_index: 0 })]);
      (uploadImportFile as jest.Mock).mockResolvedValue({ success: true, preview });

      render(<ImportPanel entityType="job" />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['a,b'], 'jobs.csv', { type: 'text/csv' });
      fireEvent.change(fileInput, { target: { files: [file] } });
      fireEvent.click(screen.getByRole('button', { name: /Tải lên & xem trước/i }));

      await waitFor(() => {
        expect(uploadImportFile).toHaveBeenCalledWith('job', file);
      });
      await waitFor(() => {
        expect(screen.getByText(/Backend Dev/i)).toBeInTheDocument();
      });
    });

    it('upload thất bại -> hiện lỗi + danh sách fileErrors', async () => {
      (uploadImportFile as jest.Mock).mockResolvedValue({
        success: false,
        error: 'File không đúng định dạng',
        fileErrors: [{ row_number: 3, field_name: 'salary_min', rule: 'type_number', message: 'Phải là số' }],
      });

      render(<ImportPanel entityType="job" />);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [new File(['x'], 'bad.csv')] } });
      fireEvent.click(screen.getByRole('button', { name: /Tải lên & xem trước/i }));

      await waitFor(() => {
        expect(screen.getByText('File không đúng định dạng')).toBeInTheDocument();
      });
      expect(screen.getByText(/Dòng 3, cột "salary_min": Phải là số/i)).toBeInTheDocument();
    });

    it('nút upload bị khoá khi chưa chọn file', () => {
      render(<ImportPanel entityType="job" />);
      expect(screen.getByRole('button', { name: /Tải lên & xem trước/i })).toBeDisabled();
    });
  });

  describe('Dòng no_conflict — không cần resolution', () => {
    it('confirm gửi resolutions rỗng cho dòng no_conflict, hiện ImportDoneCard khi xong', async () => {
      const preview = makePreview([makeRow({ row_index: 0 })]);
      (uploadImportFile as jest.Mock).mockResolvedValue({ success: true, preview });
      (confirmImport as jest.Mock).mockResolvedValue({
        success: true,
        result: { created: 1, updated: 0, skipped: 0 },
      });

      render(<ImportPanel entityType="job" />);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [new File(['x'], 'jobs.csv')] } });
      fireEvent.click(screen.getByRole('button', { name: /Tải lên & xem trước/i }));
      await screen.findByText(/Backend Dev/i);

      expect(screen.getByRole('button', { name: /Xác nhận import/i })).not.toBeDisabled();
      await fillNoteAndConfirm();

      await waitFor(() => {
        expect(confirmImport).toHaveBeenCalledWith('job', 'preview-1', {}, 'Import job từ đợt crawl tháng 9');
      });
      await waitFor(() => {
        expect(screen.getByText(/Đã tạo mới 1 bản ghi/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Import file khác/i }));
      expect(screen.getByText(/Upload file để import/i)).toBeInTheDocument();
    });

    it('thiếu ghi chú -> chặn confirm, hiện noteRequired, KHÔNG gọi confirmImport', async () => {
      const preview = makePreview([makeRow({ row_index: 0 })]);
      (uploadImportFile as jest.Mock).mockResolvedValue({ success: true, preview });

      render(<ImportPanel entityType="job" />);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [new File(['x'], 'jobs.csv')] } });
      fireEvent.click(screen.getByRole('button', { name: /Tải lên & xem trước/i }));
      await screen.findByText(/Backend Dev/i);

      fireEvent.click(screen.getByRole('button', { name: /Xác nhận import/i }));

      await waitFor(() => {
        expect(screen.getByText(/Ghi chú là bắt buộc/i)).toBeInTheDocument();
      });
      expect(confirmImport).not.toHaveBeenCalled();
    });
  });

  describe('Dòng pending_company_resolution — khoá confirm cho tới khi resolve', () => {
    function pendingCompanyPreview() {
      return makePreview([
        makeRow({
          row_index: 0,
          conflict_status: 'pending_company_resolution',
          data: { job_title: 'Backend Dev', company_name: 'Acme Corp', level_code: 'Middle', deadline: '2026-12-31' },
          company_resolution: {
            status: 'needs_resolution',
            company_id: null,
            company_is_active: null,
            suggestions: [
              { company_id: 'company-1', company_name: 'ACME Corp', tax_id: '0123456789', is_active: true, similarity: 0.92 },
            ],
          },
        }),
      ]);
    }

    it('confirm bị khoá và hiện blockedPendingCompany khi còn dòng chưa chọn công ty', async () => {
      (uploadImportFile as jest.Mock).mockResolvedValue({ success: true, preview: pendingCompanyPreview() });

      render(<ImportPanel entityType="job" />);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [new File(['x'], 'jobs.csv')] } });
      fireEvent.click(screen.getByRole('button', { name: /Tải lên & xem trước/i }));

      await screen.findByText(/Chọn công ty…/i);
      expect(screen.getByText(/1 dòng chưa chọn công ty/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Xác nhận import/i })).toBeDisabled();
    });

    it('mở modal, chọn gợi ý -> resolveCompany() -> row cập nhật thành no_conflict, mở khoá confirm', async () => {
      (uploadImportFile as jest.Mock).mockResolvedValue({ success: true, preview: pendingCompanyPreview() });
      const resolvedRow = makeRow({
        row_index: 0,
        conflict_status: 'no_conflict',
        data: { job_title: 'Backend Dev', company_name: 'Acme Corp', level_code: 'Middle', deadline: '2026-12-31' },
      });
      (resolveCompany as jest.Mock).mockResolvedValue({ success: true, row: resolvedRow });

      render(<ImportPanel entityType="job" />);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [new File(['x'], 'jobs.csv')] } });
      fireEvent.click(screen.getByRole('button', { name: /Tải lên & xem trước/i }));
      await screen.findByText(/Chọn công ty…/i);

      fireEvent.click(screen.getByRole('button', { name: /Chọn công ty…/i }));
      // Tiêu đề modal ("Chọn công ty") — dùng getByRole('heading') để
      // không đụng nút "Chọn công ty…" (dm-btn-choose-company) vẫn còn
      // trên bảng phía sau modal, cùng chứa chuỗi con "Chọn công ty".
      expect(screen.getByRole('heading', { name: 'Chọn công ty' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /ACME Corp/i }));

      await waitFor(() => {
        expect(resolveCompany).toHaveBeenCalledWith('job', 'preview-1', 0, 'company-1');
      });
      // Dùng exact string (không phải regex) để không khớp nhầm với
      // stat "Sẽ tạo mới ngay" (dm-stat-new, luôn hiện ở đầu bảng) —
      // dòng đã resolve xong hiện đúng "Sẽ tạo mới" (t('willCreate')).
      await waitFor(() => {
        expect(screen.getByText('Sẽ tạo mới')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /Xác nhận import/i })).not.toBeDisabled();
    });

    it('resolveCompany() thất bại -> hiện lỗi trong modal, modal không tự đóng', async () => {
      (uploadImportFile as jest.Mock).mockResolvedValue({ success: true, preview: pendingCompanyPreview() });
      (resolveCompany as jest.Mock).mockResolvedValue({ success: false, error: 'Công ty không tồn tại' });

      render(<ImportPanel entityType="job" />);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [new File(['x'], 'jobs.csv')] } });
      fireEvent.click(screen.getByRole('button', { name: /Tải lên & xem trước/i }));
      await screen.findByText(/Chọn công ty…/i);

      fireEvent.click(screen.getByRole('button', { name: /Chọn công ty…/i }));
      fireEvent.click(screen.getByRole('button', { name: /ACME Corp/i }));

      await waitFor(() => {
        expect(screen.getByText('Công ty không tồn tại')).toBeInTheDocument();
      });
    });

    it('chọn "+ Tạo công ty mới theo tên trong file" -> resolveCompany() gọi với companyId=null', async () => {
      (uploadImportFile as jest.Mock).mockResolvedValue({ success: true, preview: pendingCompanyPreview() });
      (resolveCompany as jest.Mock).mockResolvedValue({
        success: true,
        row: makeRow({ row_index: 0, conflict_status: 'no_conflict' }),
      });

      render(<ImportPanel entityType="job" />);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [new File(['x'], 'jobs.csv')] } });
      fireEvent.click(screen.getByRole('button', { name: /Tải lên & xem trước/i }));
      await screen.findByText(/Chọn công ty…/i);

      fireEvent.click(screen.getByRole('button', { name: /Chọn công ty…/i }));
      fireEvent.click(screen.getByRole('button', { name: /Tạo công ty mới theo tên trong file/i }));

      await waitFor(() => {
        expect(resolveCompany).toHaveBeenCalledWith('job', 'preview-1', 0, null);
      });
    });
  });

  describe('Dòng needs_field_fix — sửa tại chỗ', () => {
    function fieldFixPreview() {
      return makePreview([
        makeRow({
          row_index: 0,
          needs_field_fix: true,
          data: { job_title: 'Backend Dev', company_name: 'ACME', level_code: 'Middle', deadline: 'invalid-date' },
          field_errors: {
            deadline: {
              rule: 'type_date',
              message: 'Ngày không hợp lệ',
              raw_value: 'invalid-date',
              widget_type: 'date',
            },
          },
        }),
      ]);
    }

    it('sửa ô lỗi, bấm Xác nhận -> verifyField() thành công -> refreshPreview() tải lại toàn bộ', async () => {
      (uploadImportFile as jest.Mock).mockResolvedValue({ success: true, preview: fieldFixPreview() });
      (verifyField as jest.Mock).mockResolvedValue({
        success: true,
        fieldError: null,
        row: makeRow({ row_index: 0, needs_field_fix: false }),
      });
      const refreshedPreview = makePreview([makeRow({ row_index: 0 })]);
      (getImportPreview as jest.Mock).mockResolvedValue({ success: true, preview: refreshedPreview });

      render(<ImportPanel entityType="job" />);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [new File(['x'], 'jobs.csv')] } });
      fireEvent.click(screen.getByRole('button', { name: /Tải lên & xem trước/i }));
      await screen.findByText(/Ngày không hợp lệ/i);

      const dateInput = screen.getByPlaceholderText('YYYY-MM-DD');
      fireEvent.change(dateInput, { target: { value: '2026-12-31' } });
      fireEvent.click(screen.getByRole('button', { name: /^Xác nhận$/i }));

      await waitFor(() => {
        expect(verifyField).toHaveBeenCalledWith('job', 'preview-1', 0, 'deadline', '2026-12-31');
      });
      await waitFor(() => {
        expect(getImportPreview).toHaveBeenCalledWith('job', 'preview-1');
      });
      await waitFor(() => {
        expect(screen.queryByText(/Ngày không hợp lệ/i)).not.toBeInTheDocument();
      });
    });

    it('verifyField() vẫn báo lỗi field (fieldError khác null) -> hiện lỗi tại ô, KHÔNG refreshPreview', async () => {
      (uploadImportFile as jest.Mock).mockResolvedValue({ success: true, preview: fieldFixPreview() });
      (verifyField as jest.Mock).mockResolvedValue({
        success: true,
        fieldError: { rule: 'type_date', message: 'Vẫn sai định dạng', raw_value: 'abc', widget_type: 'date' },
      });

      render(<ImportPanel entityType="job" />);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [new File(['x'], 'jobs.csv')] } });
      fireEvent.click(screen.getByRole('button', { name: /Tải lên & xem trước/i }));
      await screen.findByText(/Ngày không hợp lệ/i);

      fireEvent.change(screen.getByPlaceholderText('YYYY-MM-DD'), { target: { value: 'abc' } });
      fireEvent.click(screen.getByRole('button', { name: /^Xác nhận$/i }));

      await waitFor(() => {
        expect(screen.getByText('Vẫn sai định dạng')).toBeInTheDocument();
      });
      expect(getImportPreview).not.toHaveBeenCalled();
    });
  });

  describe('Dòng conflict/conflict_inactive — radio Bỏ qua/Ghi đè', () => {
    it('conflict thường: chọn "Ghi đè bản ghi đã có" -> resolution action=update lúc confirm', async () => {
      const preview = makePreview([makeRow({ row_index: 0, conflict_status: 'conflict' })]);
      (uploadImportFile as jest.Mock).mockResolvedValue({ success: true, preview });
      (confirmImport as jest.Mock).mockResolvedValue({ success: true, result: { created: 0, updated: 1, skipped: 0 } });

      render(<ImportPanel entityType="job" />);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [new File(['x'], 'jobs.csv')] } });
      fireEvent.click(screen.getByRole('button', { name: /Tải lên & xem trước/i }));
      await screen.findByText(/Ghi đè bản ghi đã có/i);

      fireEvent.click(screen.getByRole('radio', { name: /Ghi đè bản ghi đã có/i }));
      await fillNoteAndConfirm();

      await waitFor(() => {
        expect(confirmImport).toHaveBeenCalledWith(
          'job',
          'preview-1',
          { '0': { action: 'update' } },
          'Import job từ đợt crawl tháng 9'
        );
      });
    });

    it('conflict_inactive: chọn Ghi đè nhưng CHƯA xác nhận kích hoạt lại -> confirm_reactivate=false', async () => {
      const preview = makePreview([makeRow({ row_index: 0, conflict_status: 'conflict_inactive' })]);
      (uploadImportFile as jest.Mock).mockResolvedValue({ success: true, preview });
      (confirmImport as jest.Mock).mockResolvedValue({ success: true, result: { created: 0, updated: 1, skipped: 0 } });

      render(<ImportPanel entityType="job" />);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [new File(['x'], 'jobs.csv')] } });
      fireEvent.click(screen.getByRole('button', { name: /Tải lên & xem trước/i }));
      await screen.findByText(/Ghi đè bản ghi đã có/i);

      fireEvent.click(screen.getByRole('radio', { name: /Ghi đè bản ghi đã có/i }));
      expect(screen.getByText(/Bản ghi đã ngừng hoạt động — ghi đè sẽ kích hoạt lại/i)).toBeInTheDocument();

      await fillNoteAndConfirm();

      await waitFor(() => {
        expect(confirmImport).toHaveBeenCalledWith(
          'job',
          'preview-1',
          { '0': { action: 'update', confirm_reactivate: false } },
          'Import job từ đợt crawl tháng 9'
        );
      });
    });

    it('conflict_inactive: chọn Ghi đè + bấm "Xác nhận kích hoạt lại" -> confirm_reactivate=true', async () => {
      const preview = makePreview([makeRow({ row_index: 0, conflict_status: 'conflict_inactive' })]);
      (uploadImportFile as jest.Mock).mockResolvedValue({ success: true, preview });
      (confirmImport as jest.Mock).mockResolvedValue({ success: true, result: { created: 0, updated: 1, skipped: 0 } });

      render(<ImportPanel entityType="job" />);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [new File(['x'], 'jobs.csv')] } });
      fireEvent.click(screen.getByRole('button', { name: /Tải lên & xem trước/i }));
      await screen.findByText(/Ghi đè bản ghi đã có/i);

      fireEvent.click(screen.getByRole('radio', { name: /Ghi đè bản ghi đã có/i }));
      fireEvent.click(screen.getByRole('button', { name: /Xác nhận kích hoạt lại/i }));

      await fillNoteAndConfirm();

      await waitFor(() => {
        expect(confirmImport).toHaveBeenCalledWith(
          'job',
          'preview-1',
          { '0': { action: 'update', confirm_reactivate: true } },
          'Import job từ đợt crawl tháng 9'
        );
      });
    });
  });

  describe('Dòng conflict_in_batch — chưa chọn hành động thì khoá confirm', () => {
    it('hiện blockedMissingBatch và khoá nút confirm khi chưa chọn radio nào', async () => {
      const preview = makePreview([
        makeRow({
          row_index: 0,
          conflict_status: 'conflict_in_batch',
          duplicate_in_batch: { other_row_index: 1, match_score: 0.95, matched_fields: ['job_title', 'company_name'] },
        }),
        makeRow({
          row_index: 1,
          conflict_status: 'conflict_in_batch',
          duplicate_in_batch: { other_row_index: 0, match_score: 0.95, matched_fields: ['job_title', 'company_name'] },
        }),
      ]);
      (uploadImportFile as jest.Mock).mockResolvedValue({ success: true, preview });

      render(<ImportPanel entityType="job" />);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [new File(['x'], 'jobs.csv')] } });
      fireEvent.click(screen.getByRole('button', { name: /Tải lên & xem trước/i }));

      await screen.findAllByText(/Trùng với dòng/i);
      expect(screen.getByText(/2 dòng trùng trong file chưa chọn xử lý/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Xác nhận import/i })).toBeDisabled();
    });

    it('chọn "keep_this" cho 1 dòng -> dòng ghép cặp KIA tự được coi là đã xử lý (không cần chọn riêng)', async () => {
      const preview = makePreview([
        makeRow({
          row_index: 0,
          conflict_status: 'conflict_in_batch',
          duplicate_in_batch: { other_row_index: 1, match_score: 0.95, matched_fields: ['job_title'] },
        }),
        makeRow({
          row_index: 1,
          conflict_status: 'conflict_in_batch',
          duplicate_in_batch: { other_row_index: 0, match_score: 0.95, matched_fields: ['job_title'] },
        }),
      ]);
      (uploadImportFile as jest.Mock).mockResolvedValue({ success: true, preview });
      (confirmImport as jest.Mock).mockResolvedValue({ success: true, result: { created: 1, updated: 0, skipped: 1 } });

      render(<ImportPanel entityType="job" />);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [new File(['x'], 'jobs.csv')] } });
      fireEvent.click(screen.getByRole('button', { name: /Tải lên & xem trước/i }));
      await screen.findAllByText(/Trùng với dòng/i);

      const keepThisRadios = screen.getAllByRole('radio', { name: /Giữ dòng này, bỏ dòng kia/i });
      fireEvent.click(keepThisRadios[0]);

      expect(screen.getByRole('button', { name: /Xác nhận import/i })).not.toBeDisabled();

      await fillNoteAndConfirm();

      await waitFor(() => {
        expect(confirmImport).toHaveBeenCalledWith(
          'job',
          'preview-1',
          { '0': { action: 'keep_this' } },
          'Import job từ đợt crawl tháng 9'
        );
      });
    });
  });
});
