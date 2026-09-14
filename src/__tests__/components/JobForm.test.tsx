/**
 * Tests for JobForm Component
 * Matches Flask: tests/test_jobs.py::TestJobsAdd pattern
 *
 * BUG FIX (đợt "ưu tiên thấp", 09/2026): ô company_id đổi từ input text
 * nhập tay UUID sang <CompanyCombobox> (search-as-you-type + chọn từ
 * dropdown) — mọi test trước đây gõ thẳng UUID vào
 * getByLabelText(/Company ID/i) không còn khớp hành vi thật (input hiển
 * thị giờ chỉ nhận TÊN công ty để tìm, giá trị company_id thật nằm ở
 * hidden input, chỉ được set khi thật sự CHỌN 1 option từ dropdown).
 * Viết lại để mock getCompanies() (Server Action gọi trực tiếp từ
 * CompanyCombobox) và mô phỏng đúng luồng gõ -> chọn option.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import JobForm from '@/components/features/JobForm';
import { createJob } from '@/app/actions/jobs';
import { getCompanies } from '@/app/actions/companies';
import { mockJob, mockJobEnums, mockCompany, mockCompaniesResponse } from '../fixtures';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock Server Actions
jest.mock('@/app/actions/jobs', () => ({
  createJob: jest.fn(),
}));

jest.mock('@/app/actions/companies', () => ({
  getCompanies: jest.fn(),
}));

/**
 * Mô phỏng luồng chọn công ty qua CompanyCombobox: focus ô tìm, gõ tên
 * công ty, chờ dropdown hiện option (getCompanies mock trả về
 * mockCompaniesResponse), rồi "click" (mousedown, đúng cách component
 * xử lý — xem CompanyCombobox.tsx) vào option để set hidden input thật.
 */
async function selectMockCompany() {
  // BUG FIX (viết test): getByRole('combobox') là AMBIGUOUS trong file
  // này — <select> HTML không có "multiple" cũng mang role ARIA ngầm
  // định "combobox" (HTML-AAM), nên form có nhiều <select> khác (ngành,
  // level, tỉnh...) cũng khớp cùng role. Dùng getByLabelText để lấy
  // đúng ô input của CompanyCombobox qua liên kết <label htmlFor>.
  const input = screen.getByLabelText(/Công ty/i) as HTMLInputElement;
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: mockCompany.company_name } });
  // Tương tự, role="option" cũng bị <option> của mọi <select> khác
  // khớp trùng — query thẳng theo class CSS thật của dropdown
  // (.cbx-panel .cbx-opt, xem CompanyCombobox.tsx) cho chắc chắn.
  const option = await waitFor(() => {
    const el = document.querySelector('.cbx-panel .cbx-opt');
    if (!el) throw new Error('company option not rendered yet');
    return el as HTMLElement;
  });
  fireEvent.mouseDown(option);
}

describe('JobForm Component', () => {
  const mockPush = jest.fn();
  const mockBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      back: mockBack,
    });
    (getCompanies as jest.Mock).mockResolvedValue(mockCompaniesResponse);
  });

  describe('Create Mode', () => {
    it('should render create form with all fields', () => {
      render(<JobForm mode="create" enums={mockJobEnums} />);

      expect(screen.getByLabelText(/Tên Job/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Công ty/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Ngành/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Level/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Địa điểm/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Lương tối thiểu/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Lương tối đa/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Tạo Job/i })).toBeInTheDocument();
    });

    it('should show required indicator on job title', () => {
      render(<JobForm mode="create" enums={mockJobEnums} />);

      const jobTitleLabel = screen.getByText(/Tên Job/i).closest('label');
      expect(jobTitleLabel).toHaveTextContent('*');
    });

    it('should submit form with valid data', async () => {
      (createJob as jest.Mock).mockResolvedValue({
        success: true,
        job: { ...mockJob, job_id: 'new-job-id' },
      });

      render(<JobForm mode="create" enums={mockJobEnums} />);

      // Fill required fields
      fireEvent.change(screen.getByLabelText(/Tên Job/i), {
        target: { value: 'Backend Developer' },
      });
      await selectMockCompany();

      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /Tạo Job/i }));

      await waitFor(() => {
        expect(createJob).toHaveBeenCalledWith(
          expect.objectContaining({
            job_title: 'Backend Developer',
            company_id: mockCompany.company_id,
          })
        );
      });
    });

    it('should redirect to job detail on success', async () => {
      (createJob as jest.Mock).mockResolvedValue({
        success: true,
        job: { ...mockJob, job_id: 'new-job-id' },
      });

      render(<JobForm mode="create" enums={mockJobEnums} />);

      fireEvent.change(screen.getByLabelText(/Tên Job/i), {
        target: { value: 'Backend Developer' },
      });
      await selectMockCompany();
      fireEvent.click(screen.getByRole('button', { name: /Tạo Job/i }));

      // BUG FIX: redirect thật dùng job.job_id (backend field thật),
      // không phải job.id (field không tồn tại trong response thật).
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/jobs/new-job-id');
      });
    });

    it('should show error message on failure', async () => {
      (createJob as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Company not found',
      });

      render(<JobForm mode="create" enums={mockJobEnums} />);

      fireEvent.change(screen.getByLabelText(/Tên Job/i), {
        target: { value: 'Backend Developer' },
      });
      await selectMockCompany();
      fireEvent.click(screen.getByRole('button', { name: /Tạo Job/i }));

      await waitFor(() => {
        expect(screen.getByText(/Company not found/i)).toBeInTheDocument();
      });
    });

    it('should disable submit button while submitting', async () => {
      (createJob as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true, job: mockJob }), 100))
      );

      render(<JobForm mode="create" enums={mockJobEnums} />);

      const submitButton = screen.getByRole('button', { name: /Tạo Job/i });

      fireEvent.change(screen.getByLabelText(/Tên Job/i), {
        target: { value: 'Backend Developer' },
      });
      await selectMockCompany();
      fireEvent.click(submitButton);

      // Button should be disabled while submitting
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveTextContent(/Đang lưu/i);

      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });

    it('should call router.back() when cancel clicked', () => {
      render(<JobForm mode="create" enums={mockJobEnums} />);

      fireEvent.click(screen.getByRole('button', { name: /Hủy/i }));

      expect(mockBack).toHaveBeenCalled();
    });
  });

  describe('Edit Mode', () => {
    it('should pre-fill form with initial data', () => {
      render(<JobForm mode="edit" initialData={mockJob} enums={mockJobEnums} />);

      const jobTitleInput = screen.getByLabelText(/Tên Job/i) as HTMLInputElement;
      // Ô tìm hiển thị TÊN công ty (initialLabel), không phải UUID.
      const companyInput = screen.getByLabelText(/Công ty/i) as HTMLInputElement;

      expect(jobTitleInput.value).toBe(mockJob.job_title);
      expect(companyInput.value).toBe(mockJob.company_name);

      // company_id thật (UUID) gửi lên server nằm ở hidden input riêng,
      // không hiển thị trực tiếp cho người dùng gõ tay nữa.
      const hiddenCompanyInput = document.querySelector('input[name="company_id"][type="hidden"]') as HTMLInputElement;
      expect(hiddenCompanyInput).not.toBeNull();
      expect(hiddenCompanyInput.value).toBe(mockJob.company_id);
    });

    it('should show "Cập nhật" button text in edit mode', () => {
      render(<JobForm mode="edit" initialData={mockJob} enums={mockJobEnums} />);

      expect(screen.getByRole('button', { name: /Cập nhật/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Tạo Job/i })).not.toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should require job title', async () => {
      render(<JobForm mode="create" enums={mockJobEnums} />);

      const jobTitleInput = screen.getByLabelText(/Tên Job/i);
      expect(jobTitleInput).toHaveAttribute('required');
    });

    it('should block submit and show an error if no company is selected', async () => {
      render(<JobForm mode="create" enums={mockJobEnums} />);

      fireEvent.change(screen.getByLabelText(/Tên Job/i), {
        target: { value: 'Backend Developer' },
      });
      // Không chọn công ty nào — chỉ gõ chữ, chưa click option nào cả,
      // nên hidden input company_id vẫn rỗng.
      fireEvent.click(screen.getByRole('button', { name: /Tạo Job/i }));

      // BUG FIX: hidden input không tự validate HTML5 "required" như
      // <select> cũ — JobForm phải tự chặn submit qua
      // CompanyCombobox::validate() (xem CompanyCombobox.tsx).
      expect(await screen.findByText(/Vui lòng chọn công ty/i)).toBeInTheDocument();
      expect(createJob).not.toHaveBeenCalled();
    });

    it('should let the user search and pick a company from the dropdown', async () => {
      render(<JobForm mode="create" enums={mockJobEnums} />);

      const input = screen.getByLabelText(/Công ty/i) as HTMLInputElement;
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: mockCompany.company_name } });

      await waitFor(() => {
        expect(getCompanies).toHaveBeenCalledWith(
          expect.objectContaining({ keyword: mockCompany.company_name })
        );
      });

      const option = await waitFor(() => {
        const el = document.querySelector('.cbx-panel .cbx-opt');
        if (!el) throw new Error('company option not rendered yet');
        return el as HTMLElement;
      });
      expect(option).toHaveTextContent(mockCompany.company_name);
      fireEvent.mouseDown(option);

      // Sau khi chọn: ô hiển thị tên công ty, hidden input mang company_id.
      expect(input.value).toBe(mockCompany.company_name);
      const hiddenCompanyInput = document.querySelector('input[name="company_id"][type="hidden"]') as HTMLInputElement;
      expect(hiddenCompanyInput.value).toBe(mockCompany.company_id);
    });
  });

  describe('Salary Fields', () => {
    it('should accept numeric input for salary fields', () => {
      render(<JobForm mode="create" enums={mockJobEnums} />);

      const salaryMinInput = screen.getByLabelText(/Lương tối thiểu/i) as HTMLInputElement;
      const salaryMaxInput = screen.getByLabelText(/Lương tối đa/i) as HTMLInputElement;

      expect(salaryMinInput.type).toBe('number');
      expect(salaryMaxInput.type).toBe('number');
    });

    it('should have salary type options', () => {
      render(<JobForm mode="create" enums={mockJobEnums} />);

      const salaryTypeSelect = screen.getByLabelText(/Loại lương/i) as HTMLSelectElement;
      const options = Array.from(salaryTypeSelect.options).map(opt => opt.value);

      expect(options).toContain('RANGE');
      expect(options).toContain('NEGOTIABLE');
      expect(options).toContain('EXACT');
    });
  });
});
