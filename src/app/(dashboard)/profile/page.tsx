import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/app/actions/auth';
import { roleLabel, isStaffRole } from '@/lib/auth/roles';
import ProfileSubnav from '@/components/features/ProfileSubnav';
import ProfileOverviewForm from '@/components/features/ProfileOverviewForm';
import ThemeToggle from '@/components/features/ThemeToggle';

/**
 * Trang cá nhân — Thông tin chung. Khớp profile.index() (GET) bên
 * Flask gốc (blueprints/profile.py) + templates/profile_overview.html.
 *
 * BUG FIX (09/2026): trước đây toàn trang chỉ là placeholder
 * "🚧 Chức năng đổi mật khẩu và cập nhật thông tin đang được phát
 * triển" — dù backend (PATCH /auth/me, POST /auth/change-password) đã
 * có sẵn từ lâu, chỉ chưa có trang thật gọi tới. Dùng đúng CSS đã
 * chuẩn bị sẵn (.auth-shell, .profile-card, .profile-subnav,
 * .profile-info-grid — public/css/02-auth.css) thay vì .page-container/
 * .profile-section/.info-grid không tồn tại của bản cũ.
 *
 * BUG FIX (build): (dashboard)/layout.tsx redirect /login nếu chưa
 * đăng nhập ở request THẬT, nhưng lúc `next build` cố prerender trang
 * này thành static shell, cookies() chưa sẵn sàng nên getCurrentUser()
 * trả về null thật sự — dùng `user!` (non-null assertion) làm build
 * crash hẳn ("Cannot read properties of null"), khác các trang khác
 * (vd /companies) không dùng `!` nên tự chịu được null lúc prerender,
 * để Next.js tự nhận route là dynamic rồi bỏ qua static generation.
 * Tự check + redirect ở đây thay vì tin layout đã chặn — vừa hết lỗi
 * build, vừa không còn 1 non-null assertion nào có thể crash runtime
 * nếu logic layout đổi sau này.
 *
 * THÊM 09/2026 — mục "Giao diện" (theme sáng/tối, `ThemeToggle.tsx`):
 * phần đầu của "Preferences (theme, language)" nêu ở mục 6.5
 * plan_nextjs.md. Flask gốc KHÔNG có tính năng này — xem docstring
 * `ThemeToggle.tsx`. Chỉ mới làm "theme", CHƯA làm "language" (chi phí
 * lớn hơn nhiều, để dành xem xét sau). Đặt ngay dưới form đổi thông
 * tin trong CÙNG `.profile-card` overview — không tách trang/tab
 * sub-nav riêng vì chỉ có đúng 1 tuỳ chọn, chưa đáng thêm 1 route mới.
 */
export default async function ProfilePage() {
  const t = await getTranslations('profilePage');
  const tRole = await getTranslations('roles');
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const isStudent = user.role === 'user';

  return (
    <div className="auth-shell">
      <div className="auth-card profile-card">
        <h1>{t('title')}</h1>
        <p className="lede">{t('lede')}</p>

        <ProfileSubnav active="overview" isStudent={isStudent} isStaff={isStaffRole(user.role)} />

        <dl className="profile-info-grid">
          <div>
            <dt className="profile-info-label">Email</dt>
            <dd className="profile-info-value">{user.email}</dd>
          </div>
          <div>
            <dt className="profile-info-label">{t('role')}</dt>
            <dd className="profile-info-value">{roleLabel(user.role, tRole)}</dd>
          </div>
          <div>
            <dt className="profile-info-label">{t('joinedAt')}</dt>
            <dd className="profile-info-value">
              {/* CỐ Ý CHƯA dịch: toLocaleDateString('vi-VN') — thuộc
                  phạm vi Polish, không xử lý ở đợt Language này. */}
              {new Date(user.created_at).toLocaleDateString('vi-VN')}
            </dd>
          </div>
          {!isStudent && (
            <div>
              <dt className="profile-info-label">{t('lastLogin')}</dt>
              <dd className="profile-info-value">
                {user.last_login_at
                  ? new Date(user.last_login_at).toLocaleDateString('vi-VN')
                  : '—'}
              </dd>
            </div>
          )}
        </dl>

        <ProfileOverviewForm user={user} />

        <h2 style={{ marginTop: '32px' }}>{t('interfaceTitle')}</h2>
        <p className="lede">{t('interfaceLede')}</p>
        <ThemeToggle />
      </div>
    </div>
  );
}
