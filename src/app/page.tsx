import { redirect } from 'next/navigation';
import { isAuthenticated } from './actions/auth';

/**
 * Root page - redirects to dashboard if authenticated, jobs list otherwise
 *
 * CHAT (theo yêu cầu, sau khi deploy lần đầu): trước đây khách (chưa
 * đăng nhập) luôn bị đá thẳng vào /login — khác Flask gốc, nơi "/" LÀ
 * trang danh sách job công khai (templates/index.html), chỉ yêu cầu
 * đăng nhập khi bấm lưu job/ứng tuyển. Đổi lại redirect('/login') ->
 * redirect('/jobs') cho khách; /jobs giờ nằm ở route group
 * (public-jobs) (không còn bị (dashboard)/layout.tsx bắt buộc đăng
 * nhập) nên vào được luôn không cần login, đúng hành vi Flask.
 */

export default async function Home() {
  const authenticated = await isAuthenticated();

  if (authenticated) {
    redirect('/dashboard');
  } else {
    redirect('/jobs');
  }
}
