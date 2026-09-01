import { getCurrentUser } from '@/app/actions/auth';

/**
 * Profile/Settings Page
 * TODO: Implement in Phase 6
 */

export default async function ProfilePage() {
  const user = await getCurrentUser();

  return (
    <div className="page-container">
      <div className="page-head">
        <h1>Cài đặt</h1>
      </div>

      <div className="profile-section">
        <h2>Thông tin cá nhân</h2>
        <div className="info-grid">
          <div>
            <label>Họ tên:</label>
            <p>{user?.full_name}</p>
          </div>
          <div>
            <label>Email:</label>
            <p>{user?.email}</p>
          </div>
          <div>
            <label>Vai trò:</label>
            <p>{user?.role}</p>
          </div>
        </div>
      </div>

      <div className="empty-state">
        <p>🚧 Chức năng đổi mật khẩu và cập nhật thông tin đang được phát triển</p>
      </div>
    </div>
  );
}
