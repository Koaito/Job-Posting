'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { logout } from '@/app/actions/auth';
import { getUnreadCount } from '@/app/actions/messages';
import { isStaffRole } from '@/lib/auth/roles';

// Poll ~25-30s (xem public/app.js gốc) — badge chỉ cần gần đúng, không
// cần realtime như khung chat (poll 5s riêng trong MessageThread.tsx).
const UNREAD_POLL_INTERVAL_MS = 25000;

interface SidebarProps {
  // BUG FIX (audit 09/2026): backend (schemas/auth.py::UserOut) không có
  // field "is_staff" — chỉ có "role" ("user" | "ss_team" | "admin").
  // Trước đây prop này khai "is_staff: boolean" nhưng getCurrentUser()
  // không bao giờ trả field đó, nên luôn undefined -> menu staff không
  // hiện ra cho bất kỳ ai, kể cả admin thật.
  user: {
    full_name: string;
    email: string;
    role: string;
  };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isStaff = isStaffRole(user.role);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const count = await getUnreadCount();
      if (!cancelled) setUnreadCount(count);
    };
    poll();
    const interval = setInterval(poll, UNREAD_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

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

        {/* Cập nhật 09/2026: /students, /staff, /crawl, /activity đều đã
            có page.tsx thật — không còn route nào 404 trong nhóm này.
            /contacts (link riêng phía trên) cũng đã dựng cùng đợt. */}
        {isStaff && (
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
          <span className="nav-badge" hidden={unreadCount === 0}>
            {unreadCount <= 99 ? unreadCount : '99+'}
          </span>
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
