import Link from 'next/link';

/**
 * Sub-nav ngang cho khu vực "trang cá nhân" — khớp
 * templates/_profile_subnav.html (blueprints/profile.py) bên Flask
 * gốc. CSS đã có sẵn từ trước (.profile-subnav, public/css/02-auth.css)
 * — chỉ 2 mục hiện có (Thông tin chung/Bảo mật), 2 mục còn lại của
 * sub-nav gốc (Job đã lưu/Đã ứng tuyển) thuộc phạm vi "my_stuff", chưa
 * làm ở đợt này nên chưa thêm vào đây.
 */
export default function ProfileSubnav({ active }: { active: 'overview' | 'security' }) {
  return (
    <nav className="profile-subnav">
      <Link href="/profile" className={active === 'overview' ? 'active' : ''}>
        Thông tin chung
      </Link>
      <Link href="/profile/security" className={active === 'security' ? 'active' : ''}>
        Bảo mật
      </Link>
    </nav>
  );
}
