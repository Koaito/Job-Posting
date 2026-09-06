import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

/**
 * Trang đích sau khi backend xử lý link xác thực email — mới 09/2026.
 *
 * GET /auth/verify-email?token=... (người dùng bấm thẳng từ email,
 * KHÔNG qua frontend) tự redirect 302 về đúng đây kèm
 * ?status=success|expired|invalid (xem docstring verify_email() ở
 * api/routers/auth_registration.py — route đó cố tình KHÔNG tự vẽ HTML,
 * để frontend hiển thị đúng theme).
 *
 * FIX (đối chiếu templates/verify_email.html + 02-auth.css thật):
 *   - auth-wrapper/auth-header/auth-footer không tồn tại trong CSS —
 *     đổi lại auth-shell/eyebrow/auth-foot.
 *   - Thiếu hẳn icon tròn trạng thái (.verify-icon + biến thể
 *     success/warn/error) — bản gốc luôn có, đã bổ sung lại.
 *   - Bản gốc dùng <p class="lede"> cho nội dung, KHÔNG bọc trong flash
 *     box màu — đổi lại cho đúng, tránh 1 trang chỉ để thông báo trạng
 *     thái mà nhìn như flash cảnh báo lỗi.
 *
 * LƯU Ý: nhánh "expired" ở bản gốc có kèm 1 form "Gửi lại email xác
 * thực" ngay tại chỗ (POST /auth/resend-verification) — bản Next.js
 * này CHƯA có form đó (chỉ dẫn link về /login), đây là thiếu 1 phần
 * CHỨC NĂNG so với bản gốc, không phải lỗi CSS — cần bổ sung riêng
 * nếu muốn khớp 100% hành vi.
 */

interface SearchParams {
  status?: string;
}

const STATUS_ICONS = {
  success: { icon: '✓', iconClass: 'verify-icon-success' },
  expired: { icon: '!', iconClass: 'verify-icon-warn' },
  invalid: { icon: '✕', iconClass: 'verify-icon-error' },
} as const;

const DEFAULT_ICON = { icon: '✕', iconClass: 'verify-icon-error' };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { status } = await searchParams;
  const t = await getTranslations('auth.verifyEmail');
  const tc = await getTranslations('auth.common');

  const iconInfo = STATUS_ICONS[status as keyof typeof STATUS_ICONS] || DEFAULT_ICON;
  const contentKey = (status && status in STATUS_ICONS ? status : 'default') as
    | 'success'
    | 'expired'
    | 'invalid'
    | 'default';
  const title = t(`${contentKey}.title`);
  const message = t(`${contentKey}.message`);

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <span className="eyebrow">{tc('eyebrowAccount')}</span>
        <div className={`verify-icon ${iconInfo.iconClass}`}>{iconInfo.icon}</div>
        <h1>{title}</h1>
        <p className="lede">{message}</p>

        <p className="auth-foot">
          {t('alreadyVerified')} <Link href="/login">{tc('backToLogin')}</Link>
        </p>
      </div>
    </div>
  );
}
