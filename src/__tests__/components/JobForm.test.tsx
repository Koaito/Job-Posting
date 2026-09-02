/**
 * Tests for JobForm Component
 * Matches Flask: tests/test_jobs.py::TestJobsAdd pattern
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import JobForm from '@/components/features/JobForm';
import { createJob } from '@/app/actions/jobs';
import { mockJob } from '../fixtures';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock Server Actions
jest.mock('@/app/actions/jobs', () => ({
  createJob: jest.fn(),
}));

describe('JobForm Component', () => {
  const mockPush = jest.fn();
  const mockBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      back: mockBack,
    });
  });

  describe('Create Mode', () => {
    it('should render create form with all fields', () => {
      render(<JobForm mode="create" />);

      expect(screen.getByLabelText(/Tên Job/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Company ID/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Ngành/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Level/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Địa điểm/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Lương tối thiểu/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Lương tối đa/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Tạo Job/i })).toBeInTheDocument();
    });

    it('should show required indicator on job title', () => {
      render(<JobForm mode="create" />);

      const jobTitleLabel = screen.getByText(/Tên Job/i).closest('label');
      expect(jobTitleLabel).toHaveTextContent('*');
    });

    it('should submit form with valid data', async () => {
      (createJob as jest.Mock).mockResolvedValue({
        success: true,
        job: { ...mockJob, job_id: 'new-job-id' },
      });

      render(<JobForm mode="create" />);

      // Fill required fields
      fireEvent.change(screen.getByLabelText(/Tên Job/i), {
        target: { value: 'Backend Developer' },
      });
      fireEvent.change(screen.getByLabelText(/Company ID/i), {
        target: { value: 'company-1' },
      });

      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /Tạo Job/i }));

      await waitFor(() => {
        expect(createJob).toHaveBeenCalledWith(
          expect.objectContaining({
            job_title: 'Backend Developer',
            company_id: 'company-1',
          })
        );
      });
    });

    it('should redirect to job detail on success', async () => {
      (createJob as jest.Mock).mockResolvedValue({
        success: true,
        job: { ...mockJob, job_id: 'new-job-id' },
      });

      render(<JobForm mode="create" />);

      fireEvent.change(screen.getByLabelText(/Tên Job/i), {
        target: { value: 'Backend Developer' },
      });
      fireEvent.change(screen.getByLabelText(/Company ID/i), {
        target: { value: 'company-1' },
      });
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

      render(<JobForm mode="create" />);

      fireEvent.change(screen.getByLabelText(/Tên Job/i), {
        target: { value: 'Backend Developer' },
      });
      fireEvent.change(screen.getByLabelText(/Company ID/i), {
        target: { value: 'invalid-id' },
      });
      fireEvent.click(screen.getByRole('button', { name: /Tạo Job/i }));

      await waitFor(() => {
        expect(screen.getByText(/Company not found/i)).toBeInTheDocument();
      });
    });

    it('should disable submit button while submitting', async () => {
      (createJob as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true, job: mockJob }), 100))
      );

      render(<JobForm mode="create" />);

      const submitButton = screen.getByRole('button', { name: /Tạo Job/i });
      
      fireEvent.change(screen.getByLabelText(/Tên Job/i), {
        target: { value: 'Backend Developer' },
      });
      fireEvent.change(screen.getByLabelText(/Company ID/i), {
        target: { value: 'company-1' },
      });
      fireEvent.click(submitButton);

      // Button should be disabled while submitting
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveTextContent(/Đang lưu/i);

      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });

    it('should call router.back() when cancel clicked', () => {
      render(<JobForm mode="create" />);

      fireEvent.click(screen.getByRole('button', { name: /Hủy/i }));

      expect(mockBack).toHaveBeenCalled();
    });
  });

  describe('Edit Mode', () => {
    it('should pre-fill form with initial data', () => {
      render(<JobForm mode="edit" initialData={mockJob} />);

      const jobTitleInput = screen.getByLabelText(/Tên Job/i) as HTMLInputElement;
      const companyIdInput = screen.getByLabelText(/Company ID/i) as HTMLInputElement;

      expect(jobTitleInput.value).toBe(mockJob.job_title);
      expect(companyIdInput.value).toBe(mockJob.company_id);
    });

    it('should show "Cập nhật" button text in edit mode', () => {
      render(<JobForm mode="edit" initialData={mockJob} />);

      expect(screen.getByRole('button', { name: /Cập nhật/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Tạo Job/i })).not.toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should require job title', async () => {
      render(<JobForm mode="create" />);

      const jobTitleInput = screen.getByLabelText(/Tên Job/i);
      expect(jobTitleInput).toHaveAttribute('required');
    });

    it('should require company id', async () => {
      render(<JobForm mode="create" />);

      const companyIdInput = screen.getByLabelText(/Company ID/i);
      expect(companyIdInput).toHaveAttribute('required');
    });

    it('should show TODO note for company autocomplete', () => {
      render(<JobForm mode="create" />);

      expect(screen.getByText(/TODO: Thay bằng autocomplete selector/i)).toBeInTheDocument();
    });
  });

  describe('Salary Fields', () => {
    it('should accept numeric input for salary fields', () => {
      render(<JobForm mode="create" />);

      const salaryMinInput = screen.getByLabelText(/Lương tối thiểu/i) as HTMLInputElement;
      const salaryMaxInput = screen.getByLabelText(/Lương tối đa/i) as HTMLInputElement;

      expect(salaryMinInput.type).toBe('number');
      expect(salaryMaxInput.type).toBe('number');
    });

    it('should have salary type options', () => {
      render(<JobForm mode="create" />);

      const salaryTypeSelect = screen.getByLabelText(/Loại lương/i) as HTMLSelectElement;
      const options = Array.from(salaryTypeSelect.options).map(opt => opt.value);

      expect(options).toContain('RANGE');
      expect(options).toContain('NEGOTIABLE');
      expect(options).toContain('EXACT');
    });
  });
});
