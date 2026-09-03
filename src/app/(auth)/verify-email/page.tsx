/**
 * Trang landing sau khi xác thực email (audit 09/2026 #15) — người dùng
 * KHÔNG vào thẳng trang này, mà bấm link trong email trỏ tới backend
 * (GET /auth/verify-email?token=..., xem api/email_service.py), backend
 * xử lý token rồi 302 REDIRECT về đúng FRONTEND_BASE_URL/verify-email
 * kèm ?status=success|expired|invalid (xem
 * api/routers/auth_registration.py::verify_email()) — trang này chỉ cần
 * đọc lại "status" và hiển thị đúng theme, KHÔNG tự gọi API nào cả.
 */

interface SearchParams {
  status?: 'success' | 'expired' | 'invalid';
}

const CONTENT: Record<string, { title: string; message: string }> = {
  success: {
    title: 'Xác thực thành công',
    message: 'Email của bạn đã được xác thực — giờ có thể đăng nhập bình thường.',
  },
  expired: {
    title: 'Link đã hết hạn',
    message: 'Link xác thực email này đã hết hạn (24h). Hãy đăng nhập để xin gửi lại email xác thực.',
  },
  invalid: {
    title: 'Link không hợp lệ',
    message: 'Link xác thực email không hợp lệ hoặc đã được dùng trước đó.',
  },
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { status } = await searchParams;
  const content = (status && CONTENT[status]) || {
    title: 'Xác thực email',
    message: 'Vui lòng bấm vào link xác thực trong email đã đăng ký.',
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <h1>{content.title}</h1>
          <p>{content.message}</p>
        </div>
        <div className="auth-footer">
          <a href="/login" className="link-muted">Đến trang đăng nhập</a>
        </div>
      </div>
    </div>
  );
}
