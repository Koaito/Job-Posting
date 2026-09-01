import { getDashboardStats } from '@/app/actions/dashboard';
import { getCurrentUser } from '@/app/actions/auth';

/**
 * Dashboard Homepage  
 * Shows 6 KPI cards matching Flask dashboard exactly
 * Corresponds to: templates/dashboard.html lines 30-52
 */

export default async function DashboardPage() {
  // Fetch user and stats in parallel for better performance
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
          ✅ Phase 2 hoàn thành: Dashboard stats đang hiển thị 6 KPIs (khớp Flask dashboard)<br />
          🚧 Phase 3: Jobs CRUD đang chờ phát triển (list, create, edit, delete)
        </p>
      </div>
    </div>
  );
}
