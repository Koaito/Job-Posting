/**
 * Tests for ToastProvider / useToast() — B.1 Polish (mục 6.6, 09/2026).
 * Đối chiếu hành vi với showToast() gốc (public/app.js, Flask —
 * repo mindx-jobs): tự ẩn sau 3200ms, class .toast-{kind}.
 */

import { render, screen, act } from '@testing-library/react';
import { ToastProvider, useToast } from '@/components/ui/toast/ToastProvider';

function TestButtons() {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast.success('Đã lưu thành công.')}>fire-success</button>
      <button onClick={() => toast.error('Có lỗi xảy ra.')}>fire-error</button>
    </div>
  );
}

describe('ToastProvider / useToast()', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('useToast() gọi NGOÀI ToastProvider -> throw lỗi rõ ràng, không no-op im lặng', () => {
    // Nuốt console.error của React cho error boundary log mặc định.
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    function Broken() {
      useToast();
      return null;
    }
    expect(() => render(<Broken />)).toThrow('useToast() phải được gọi bên trong <ToastProvider>.');
    spy.mockRestore();
  });

  it('toast.success()/error() render đúng message + class .toast-{kind}', () => {
    render(
      <ToastProvider>
        <TestButtons />
      </ToastProvider>
    );
    act(() => {
      screen.getByText('fire-success').click();
    });
    const successToast = screen.getByText('Đã lưu thành công.');
    expect(successToast).toHaveClass('toast', 'toast-success');

    act(() => {
      screen.getByText('fire-error').click();
    });
    const errorToast = screen.getByText('Có lỗi xảy ra.');
    expect(errorToast).toHaveClass('toast', 'toast-error');
  });

  it('nhiều toast cùng lúc -> stack (giữ cả 2), không ghi đè nhau', () => {
    render(
      <ToastProvider>
        <TestButtons />
      </ToastProvider>
    );
    act(() => {
      screen.getByText('fire-success').click();
      screen.getByText('fire-error').click();
    });
    expect(screen.getByText('Đã lưu thành công.')).toBeInTheDocument();
    expect(screen.getByText('Có lỗi xảy ra.')).toBeInTheDocument();
  });

  it('tự ẩn sau ĐÚNG 3200ms (khớp showToast() gốc, public/app.js) — chưa hết giờ thì vẫn còn', () => {
    render(
      <ToastProvider>
        <TestButtons />
      </ToastProvider>
    );
    act(() => {
      screen.getByText('fire-success').click();
    });
    expect(screen.getByText('Đã lưu thành công.')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(3199);
    });
    expect(screen.getByText('Đã lưu thành công.')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.queryByText('Đã lưu thành công.')).not.toBeInTheDocument();
  });
});
