import { getDashboardStats } from '@/app/actions/dashboard';
import { getCurrentUser } from '@/app/actions/auth';

/**
 * Dashboard Homepage
 * Shows 6 KPI cards matching Flask dashboard exactly
 * Corresponds to: templates/dashboard.html lines 30-52
 *
 * BUG FIX (audit 09/2026): route này trước đây nằm ở app/dashboard/page.tsx
 * (NGOÀI route group (dashboard)/) — không đi qua (dashboard)/layout.tsx
 * nên KHÔNG có Sidebar, và KHÔNG bị redirect về /login nếu chưa đăng
 * nhập (middleware chặn được phần lộ dữ liệu, nhưng UX vẫn "trơ trọi").
 * Chuyển file vào trong route group để dùng chung layout/auth check với
 * mọi trang khác trong (dashboard)/.
 */

export default async function DashboardPage() {
  // Layout cha ((dashboard)/layout.tsx) đã gọi getCurrentUser() để lấy
  // user cho Sidebar + redirect nếu chưa đăng nhập — gọi lại ở đây để
  // lấy full_name hiển thị ở welcome message, chấp nhận gọi API 2 lần
  // (không phải bug, chỉ là chưa tối ưu — có thể truyền qua context sau).
  const [user, stats] = await Promise.all([
    getCurrentUser(),
    getDashboardStats(),
  ]);

  return (
    <div className="page-container">
      <div className="page-head">
        <h1>Tổng quan thị trường job & database doanh nghiệp</h1>
        <p className="muted">Số liệu cập nhật theo dữ liệu hiện có trong hệ thống.</p>
      </div>

      {/* KPI Cards - Matches Flask dashboard exactly (6 cards) */}
      <div className="kpi-row">
        <div className="kpi-card">
          <span className="kpi-num">{stats.total_jobs.toLocaleString()}</span>
          <span className="kpi-label">Job trong database</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-num">{stats.total_companies.toLocaleString()}</span>
          <span className="kpi-label">Công ty trong database</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-num">{stats.jobs_open.toLocaleString()}</span>
          <span className="kpi-label">Job đang còn tuyển</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-num">
            {stats.total_students !== null ? stats.total_students.toLocaleString() : '—'}
          </span>
          <span className="kpi-label">Học viên đã đăng ký</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-num">{stats.total_applications.toLocaleString()}</span>
          <span className="kpi-label">Lượt ứng tuyển</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-num">{stats.total_saved_jobs.toLocaleString()}</span>
          <span className="kpi-label">Job đã lưu</span>
        </div>
      </div>

      {/* Welcome message */}
      <div className="welcome-section" style={{ marginTop: '32px' }}>
        <h2>Chào mừng trở lại, {user?.full_name || 'bạn'}! 👋</h2>
        <p className="muted">
          {/* BUG FIX: text cũ báo "Phase 3: Jobs CRUD đang chờ phát triển"
              dù thực tế đã code xong (dù trước đây đang lỗi) — cập nhật
              lại đúng trạng thái sau khi Sprint 1 đã sửa Jobs CRUD. */}
          ✅ Phase 2 hoàn thành: Dashboard stats đang hiển thị 6 KPIs (khớp Flask dashboard)<br />
          ✅ Phase 3 hoàn thành: Jobs CRUD (list, create, edit, delete)
        </p>
      </div>
    </div>
  );
}
