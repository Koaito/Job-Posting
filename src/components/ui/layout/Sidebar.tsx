'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { logout } from '@/app/actions/auth';

interface SidebarProps {
  user: {
    full_name: string;
    email: string;
    is_staff: boolean;
  };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
    router.refresh();
  };

  const isActive = (path: string) => pathname.startsWith(path);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>MindX Jobs</h2>
        <p className="sidebar-user">{user.full_name}</p>
      </div>

      <nav className="sidebar-nav">
        <Link
          href="/dashboard"
          className={`nav-item ${pathname === '/dashboard' ? 'active' : ''}`}
        >
          📊 Dashboard
        </Link>

        <Link
          href="/jobs"
          className={`nav-item ${isActive('/jobs') ? 'active' : ''}`}
        >
          💼 Công việc
        </Link>

        <Link
          href="/companies"
          className={`nav-item ${isActive('/companies') ? 'active' : ''}`}
        >
          🏢 Công ty
        </Link>

        <Link
          href="/contacts"
          className={`nav-item ${isActive('/contacts') ? 'active' : ''}`}
        >
          👥 Liên hệ
        </Link>

        {user.is_staff && (
          <>
            <Link
              href="/students"
              className={`nav-item ${isActive('/students') ? 'active' : ''}`}
            >
              🎓 Học viên
            </Link>

            <Link
              href="/staff"
              className={`nav-item ${isActive('/staff') ? 'active' : ''}`}
            >
              👨‍💼 Nhân viên
            </Link>

            <Link
              href="/crawl"
              className={`nav-item ${isActive('/crawl') ? 'active' : ''}`}
            >
              🕷️ Crawler
            </Link>

            <Link
              href="/activity"
              className={`nav-item ${isActive('/activity') ? 'active' : ''}`}
            >
              📋 Hoạt động
            </Link>
          </>
        )}

        <Link
          href="/messages"
          className={`nav-item ${isActive('/messages') ? 'active' : ''}`}
        >
          💬 Tin nhắn
        </Link>

        <Link
          href="/profile"
          className={`nav-item ${isActive('/profile') ? 'active' : ''}`}
        >
          ⚙️ Cài đặt
        </Link>

        <button
          onClick={handleLogout}
          className="nav-item logout-btn"
        >
          🚪 Đăng xuất
        </button>
      </nav>
    </aside>
  );
}
