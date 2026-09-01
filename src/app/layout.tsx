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
      <body>
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
