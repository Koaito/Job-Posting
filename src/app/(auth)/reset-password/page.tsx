'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { resetPassword } from '@/app/actions/auth';

/**
 * Trang đặt lại mật khẩu bằng token (audit 09/2026 #15) — địa chỉ link
 * trong email do backend gửi (xem api/email_service.py::
 * send_password_reset_email(), FRONTEND_BASE_URL/reset-password?token=...)
 * — PHẢI đúng path "/reset-password" và đọc param "token" từ query
 * string, không phải trang tự sinh token.
 *
 * Token hết hạn sau 1h và dùng ĐÚNG 1 LẦN (xem docstring
 * reset_password() ở auth_registration.py) — nếu hết hạn/không hợp lệ,
 * backend trả lỗi rõ ràng qua resetPassword(), form hiện lại luôn thay
 * vì cố đoán lý do.
 */
function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

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
        setDone(true);
      } else {
        setError(result.error || 'Không thể đặt lại mật khẩu.');
      }
    } catch {
      setError('Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Link không hợp lệ</h1>
            <p>Thiếu token đặt lại mật khẩu — hãy mở lại link trong email, hoặc xin link mới.</p>
          </div>
          <div className="auth-footer">
            <a href="/forgot-password" className="link-muted">Xin link mới</a>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Đã đổi mật khẩu</h1>
            <p>Mật khẩu của bạn đã được đặt lại thành công — hãy đăng nhập lại bằng mật khẩu mới.</p>
          </div>
          <button className="btn btn-primary btn-block" onClick={() => router.push('/login')}>
            Đến trang đăng nhập
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Đặt lại mật khẩu</h1>
          <p>Nhập mật khẩu mới cho tài khoản của bạn.</p>
        </div>

        {error && (
          <div className="flash flash-error">
            {error}
            {' '}
            <a href="/forgot-password" className="link-muted">Xin link mới</a>
          </div>
        )}

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
    </div>
  );
}

/**
 * BUG FIX: useSearchParams() bắt buộc phải nằm trong <Suspense> ở
 * Next.js App Router (client component đọc query string trong 1 trang
 * KHÔNG có searchParams prop ở tầng page như jobs/page.tsx) — thiếu
 * Suspense sẽ làm "next build" lỗi ("useSearchParams() should be
 * wrapped in a suspense boundary").
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
