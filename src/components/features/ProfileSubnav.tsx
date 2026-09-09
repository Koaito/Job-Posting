import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

/**
 * Sub-nav ngang cho khu vực "trang cá nhân" — khớp
 * templates/_profile_subnav.html (blueprints/profile.py) bên Flask
 * gốc. CSS đã có sẵn từ trước (.profile-subnav, public/css/02-auth.css).
 *
 * Job đã lưu/Đã ứng tuyển (isStudent) trỏ về path CŨ /saved-jobs,
 * /my-applications — Flask gốc đã dời 2 route này sang
 * /profile/saved-jobs, /profile/applications (vẫn thuộc blueprint
 * my_stuff.py, chỉ đổi path để nằm chung sub-nav), nhưng Next.js CHƯA
 * dời theo (ngoài phạm vi mục "Module còn thiếu" — chỉ thêm
 * /profile/activity ở đợt này), nên trỏ thẳng path hiện có để không
 * link vào route chưa tồn tại.
 * Hoạt động (isStaff) — mới 09/2026, trỏ /profile/activity.
 *
 * i18n (Giai đoạn 2, nhóm 5, 09/2026): dịch qua
 * getTranslations('profileSubnav') — dùng bản async vì đây là Server
 * Component (được gọi trực tiếp từ profile/*.tsx, không có 'use client').
 */
export default async function ProfileSubnav({
  active,
  isStudent,
  isStaff,
}: {
  active: 'overview' | 'security' | 'saved-jobs' | 'applications' | 'activity';
  isStudent?: boolean;
  isStaff?: boolean;
}) {
  const t = await getTranslations('profileSubnav');

  return (
    <nav className="profile-subnav">
      <Link href="/profile" className={active === 'overview' ? 'active' : ''}>
        {t('overview')}
      </Link>
      <Link href="/profile/security" className={active === 'security' ? 'active' : ''}>
        {t('security')}
      </Link>
      {isStudent && (
        <>
          <Link href="/saved-jobs" className={active === 'saved-jobs' ? 'active' : ''}>
            {t('savedJobs')}
          </Link>
          <Link href="/my-applications" className={active === 'applications' ? 'active' : ''}>
            {t('applications')}
          </Link>
        </>
      )}
      {isStaff && (
        <Link href="/profile/activity" className={active === 'activity' ? 'active' : ''}>
          {t('activity')}
        </Link>
      )}
    </nav>
  );
}
