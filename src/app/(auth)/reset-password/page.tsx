'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { resetPassword } from '@/app/actions/auth';

/**
 * Trang đặt lại mật khẩu — mới 09/2026.
 *
 * Link email trỏ về đúng đây: FRONTEND_BASE_URL + "/reset-password?token=..."
 * (xem api/email_service.py::send_password_reset_email — reset_url).
 * Token THÔ nằm trên query string, gửi thẳng lên POST /auth/reset-password,
 * dùng đúng 1 lần, hết hạn sau 1h.
 *
 * BUG FIX phòng ngừa: useSearchParams() bắt buộc phải nằm trong 1
 * <Suspense> boundary khi build static (next build sẽ fail nếu không —
 * xem lỗi thật "useSearchParams() should be wrapped in a suspense
 * boundary" nếu bỏ Suspense ở đây), nên tách phần đọc token ra 1
 * component con, default export chỉ lo bọc Suspense.
 */
function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="auth-card">
        <div className="auth-header">
          <h1>Link không hợp lệ</h1>
          <p>Thiếu token trong đường dẫn — vui lòng dùng đúng link trong email, hoặc xin link mới.</p>
        </div>
        <div className="auth-footer">
          <Link href="/forgot-password" className="link-muted">Xin link đặt lại mật khẩu mới</Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Xác nhận mật khẩu không khớp.');
      return;
    }

    setLoading(true);
    try {
      const result = await resetPassword(token, newPassword);
      if (result.success) {
        setMessage(result.message || 'Đặt lại mật khẩu thành công — vui lòng đăng nhập lại bằng mật khẩu mới.');
      } else {
        setError(result.error || 'Đặt lại mật khẩu thất bại — link có thể đã hết hạn hoặc đã được dùng.');
      }
    } catch {
      setError('Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  if (message) {
    return (
      <div className="auth-card">
        <div className="auth-header">
          <h1>Thành công</h1>
        </div>
        <div className="flash flash-success">{message}</div>
        <div className="auth-footer">
          <Link href="/login" className="link-muted">Về trang đăng nhập</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <div className="auth-header">
        <h1>Đặt lại mật khẩu</h1>
      </div>

      {error && <div className="flash flash-error">{error}</div>}

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label htmlFor="newPassword">Mật khẩu mới</label>
          <input
            type="password"
            id="newPassword"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Tối thiểu 8 ký tự"
            required
            minLength={8}
            disabled={loading}
            autoComplete="new-password"
          />
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">Xác nhận mật khẩu mới</label>
          <input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            disabled={loading}
            autoComplete="new-password"
          />
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? 'Đang đặt lại...' : 'Đặt lại mật khẩu'}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="auth-wrapper">
      <Suspense fallback={<div className="auth-card">Đang tải...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
