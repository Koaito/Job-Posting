import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/auth';

/**
 * Dashboard route-group layout
 *
 * CHUYỂN 09/2026 (xem chat134): Sidebar + .shell/.content đã dời lên
 * root layout.tsx (bọc TOÀN app, kể cả (auth)/) — file này giờ CHỈ còn
 * lo phần đặc thù của nhóm (dashboard)/: bắt buộc đăng nhập + ép đổi
 * mật khẩu tạm trước khi dùng bất kỳ trang nào khác. KHÔNG tự vẽ
 * layout/sidebar riêng nữa (tránh lồng 2 lớp .shell/.sidebar).
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  // Redirect to login if not authenticated
  if (!user) {
    redirect('/login');
  }

  // BUG FIX (audit 09/2026 #3): must_change_password=true nghĩa là tài
  // khoản đang dùng mật khẩu TẠM (admin vừa tạo/vừa reset) — bắt buộc
  // đổi trước khi dùng bất kỳ trang nào khác trong (dashboard)/, giống
  // hành vi backend mong đợi (xem schemas/auth.py::UserOut). Trước đây
  // không có check này nên user mật khẩu tạm dùng app bình thường vô
  // thời hạn. /change-password nằm ngoài route group này (route group
  // (auth)/) nên KHÔNG bị chặn lại ở đây — tránh redirect loop.
  if (user.must_change_password) {
    redirect('/change-password');
  }

  return <>{children}</>;
}
