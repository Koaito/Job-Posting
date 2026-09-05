import type { Metadata } from "next";
import { QueryProvider } from "@/lib/providers/QueryProvider";
import { Sidebar } from "@/components/ui/layout/Sidebar";
import { getCurrentUser } from "@/app/actions/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "MindX Jobs Platform",
  description: "Job posting and management system for MindX",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // CHUYỂN 09/2026 (xem chat134): gọi getCurrentUser() ngay ở ĐÂY —
  // root layout bọc MỌI route, kể cả nhóm (auth)/ — thay vì chỉ trong
  // (dashboard)/layout.tsx như trước. getCurrentUser() vốn đã trả về
  // null an toàn khi chưa đăng nhập (không throw, xem actions/auth.ts),
  // nên Sidebar nhận thẳng user|null và tự lo trạng thái guest. Đây
  // cũng là lý do login/register trước đây KHÔNG có sidebar — layout
  // của (auth)/ chưa từng gọi hàm này.
  const user = await getCurrentUser();

  return (
    <html lang="vi">
      <head>
        <script
          // Chạy TRƯỚC khi React hydrate — đọc lựa chọn thu gọn sidebar
          // đã lưu (localStorage) và gắn class ngay trên <html>, tránh
          // nháy (FOUC): sidebar rộng rồi mới co lại 1 nhịp sau khi JS
          // chạy. Giống hệt inline script trong templates/base.html bên
          // Flask gốc — Sidebar.tsx (client component) chỉ cần đọc lại
          // đúng class này để đồng bộ nút, không tự gắn class lần đầu.
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{if(localStorage.getItem("sidebarCollapsed")==="1"){document.documentElement.classList.add("sidebar-collapsed");}}catch(e){}})();',
          }}
        />
        <link rel="stylesheet" href="/css/00-tokens.css" />
        <link rel="stylesheet" href="/css/01-sidebar.css" />
        <link rel="stylesheet" href="/css/02-auth.css" />
        <link rel="stylesheet" href="/css/03-layout.css" />
        <link rel="stylesheet" href="/css/04-job-cards.css" />
        <link rel="stylesheet" href="/css/05-contact-table.css" />
        <link rel="stylesheet" href="/css/06-detail-page.css" />
        <link rel="stylesheet" href="/css/07-forms.css" />
        <link rel="stylesheet" href="/css/08-dashboard.css" />
        <link rel="stylesheet" href="/css/09-misc-toasts.css" />
        <link rel="stylesheet" href="/css/10-pagination-responsive.css" />
        <link rel="stylesheet" href="/css/11-student-activity.css" />
        <link rel="stylesheet" href="/css/12-activity-logs.css" />
        <link rel="stylesheet" href="/css/13-data-management.css" />
        <link rel="stylesheet" href="/css/14-email-templates.css" />
        <link rel="stylesheet" href="/css/15-crawl.css" />
        <link rel="stylesheet" href="/css/16-email-template-manager.css" />
        <link rel="stylesheet" href="/css/17-error-pages.css" />
        <link rel="stylesheet" href="/css/18-messages.css" />
      </head>
      <body>
        <QueryProvider>
          <div className="shell">
            <Sidebar user={user} />
            <main className="content">{children}</main>
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
