import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, isValidLocale } from '@/i18n/config';

/**
 * Middleware for authentication
 * Protects dashboard routes and redirects authenticated users away from auth pages
 */

export function middleware(request: NextRequest) {
  const accessToken = request.cookies.get('access_token')?.value;
  const { pathname } = request.nextUrl;

  // i18n (Giai đoạn 2, 09/2026): set cookie `locale` mặc định NGAY LẦN
  // ĐẦU nếu request chưa có (hoặc có giá trị hỏng) — để
  // src/i18n/request.ts luôn đọc được giá trị hợp lệ mà không cần tự
  // fallback lặp lại ở mỗi request. Đặt ở ĐẦU hàm, TRƯỚC mọi
  // redirect/return bên dưới, vì các nhánh return sớm (redirect
  // login/dashboard) vẫn cần cookie này được set trên response. Không
  // đụng gì tới logic auth cũ (isProtectedPage/isAuthPage) — chỉ cộng
  // thêm 1 bước độc lập.
  const existingLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  const needsLocaleCookie = !isValidLocale(existingLocale);
  // Áp cho MỌI nhánh response bên dưới (redirect lẫn next()) — 1 chỗ
  // duy nhất, tránh quên set ở 1 trong 3 điểm return.
  const withLocaleCookie = (response: NextResponse) => {
    if (needsLocaleCookie) {
      response.cookies.set(LOCALE_COOKIE_NAME, DEFAULT_LOCALE, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
      });
    }
    return response;
  };

  // Define protected and auth-only routes
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');
  const isProtectedPage = pathname.startsWith('/dashboard') || 
                          pathname.startsWith('/jobs') ||
                          pathname.startsWith('/companies') ||
                          pathname.startsWith('/contacts') ||
                          pathname.startsWith('/crawl') ||
                          pathname.startsWith('/students') ||
                          pathname.startsWith('/staff') ||
                          pathname.startsWith('/messages') ||
                          pathname.startsWith('/activity') ||
                          pathname.startsWith('/profile') ||
                          // BUG FIX (audit 09/2026 #3): /change-password cần
                          // access_token (đọc từ cookie thô, KHÔNG gọi API ở
                          // middleware) như mọi trang khác — nhưng CỐ TÌNH
                          // không đưa vào isAuthPage bên dưới, vì trang này
                          // phải giữ cho cả user must_change_password=true
                          // truy cập được, không bị đá thẳng sang /dashboard
                          // chỉ vì đang có access_token hợp lệ.
                          pathname.startsWith('/change-password');

  // Redirect to login if accessing protected page without token
  if (isProtectedPage && !accessToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return withLocaleCookie(NextResponse.redirect(loginUrl));
  }

  // Redirect to dashboard if accessing auth pages with valid token
  if (isAuthPage && accessToken) {
    return withLocaleCookie(NextResponse.redirect(new URL('/dashboard', request.url)));
  }

  return withLocaleCookie(NextResponse.next());
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon file)
     * - public folder (public assets)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css)$).*)',
  ],
};
