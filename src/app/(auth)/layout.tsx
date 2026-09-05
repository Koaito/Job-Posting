/**
 * Auth route-group layout
 *
 * CHUYỂN 09/2026 (xem chat134): bỏ hẳn div "auth-layout" (class ảo,
 * không tồn tại trong CSS thật — 1 trong 47 class "ma" audit ra được).
 * .shell/.sidebar/.content đã bọc sẵn ở root layout.tsx (Sidebar tự
 * nhận diện guest qua user=null), nhóm (auth)/ chỉ cần trả thẳng
 * children — đây cũng là chỗ trước đây khiến login/register hoàn toàn
 * không có sidebar.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
