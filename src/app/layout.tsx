import type { Metadata } from "next";
import { QueryProvider } from "@/lib/providers/QueryProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "MindX Jobs Platform",
  description: "Job posting and management system for MindX",
};

export default function RootLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  return (
    <html lang="vi">
      <head>
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
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
