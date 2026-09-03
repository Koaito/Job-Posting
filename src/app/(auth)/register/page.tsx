'use client';

import { useState } from 'react';
import { register } from '@/app/actions/auth';

/**
 * Trang đăng ký tài khoản (audit 09/2026 #15) — trước đây link "Đăng ký
 * tài khoản mới" ở /login trỏ tới route KHÔNG tồn tại (404), dù backend
 * (POST /auth/register) đã có sẵn đầy đủ. Luôn tạo role='user' — muốn
 * lên ss_team/admin phải nhờ admin nâng cấp sau qua /staff (xem
 * docstring register() ở auth_registration.py, không có ô chọn role
 * ở form này).
 *
 * Đăng ký xong KHÔNG login được ngay — backend chặn login trước khi xác
 * thực email (gửi qua GET /auth/verify-email?token=..., landing lại ở
 * /verify-email sau khi backend redirect) — nên form không đá về
 * /dashboard, chỉ hiện thông báo kiểm tra email.
 */
export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [track, setTrack] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Xác nhận mật khẩu không khớp.');
      return;
    }

    setLoading(true);

    try {
      const result = await register({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim() || null,
        track: track.trim() || null,
      });

      if (result.success) {
        setSuccessMessage(
          result.message ||
            'Đăng ký thành công — kiểm tra email để xác thực tài khoản trước khi đăng nhập.'
        );
      } else {
        setError(result.error || 'Đăng ký thất bại');
      }
    } catch {
      setError('Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  if (successMessage) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Kiểm tra email của bạn</h1>
            <p>{successMessage}</p>
          </div>
          <div className="auth-footer">
            <a href="/login" className="link-muted">Quay lại đăng nhập</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Đăng ký tài khoản</h1>
          <p>Tạo tài khoản học viên trên MindX Jobs</p>
        </div>

        {error && <div className="flash flash-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="full_name">Họ tên</label>
            <input
              type="text"
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={loading}
              autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              required
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">Số điện thoại (không bắt buộc)</label>
            <input
              type="tel"
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
              autoComplete="tel"
            />
          </div>

          <div className="form-group">
            <label htmlFor="track">Track học (không bắt buộc)</label>
            <input
              type="text"
              id="track"
              value={track}
              onChange={(e) => setTrack(e.target.value)}
              placeholder="VD: Data Analysis"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Mật khẩu</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tối thiểu 8 ký tự"
              required
              minLength={8}
              disabled={loading}
              autoComplete="new-password"
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Xác nhận mật khẩu</label>
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
            {loading ? 'Đang đăng ký...' : 'Đăng ký'}
          </button>
        </form>

        <div className="auth-footer">
          <a href="/login" className="link-muted">Đã có tài khoản? Đăng nhập</a>
        </div>
      </div>
    </div>
  );
}
