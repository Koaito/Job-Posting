/**
 * Dashboard Homepage  
 * Shows welcome message and stats (TODO: implement stats)
 */

export default function DashboardPage() {
  return (
    <div className="page-container">
      <div className="page-head">
        <h1>Dashboard</h1>
      </div>

      <div className="welcome-section">
        <h2>Chào mừng trở lại! 👋</h2>
        <p className="muted">Đây là trang tổng quan của bạn.</p>
      </div>

      <div className="empty-state">
        <p>
          🚀 <strong>Phase 1 hoàn thành!</strong>
        </p>
        <p className="muted">
          Authentication đã được migrate. Bước tiếp theo: implement các features (Jobs, Companies, v.v.)
        </p>
      </div>
    </div>
  );
}
