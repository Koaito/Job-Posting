// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'
import viMessages from './src/messages/vi.json'

// MOCK next-intl (thêm khi bắt đầu dịch component, Giai đoạn 2 "JobForm/
// CompanyForm", 09/2026): next-intl build ra ESM thuần trong
// node_modules (export{...}from...), Jest mặc định KHÔNG transform
// node_modules — component nào import `useTranslations` từ 'next-intl'
// (Sidebar/LanguageToggle/trang auth/JobForm/CompanyForm...) mà có test
// gọi render() sẽ vỡ với "SyntaxError: Unexpected token 'export'" ngay
// từ bước load module, che khuất hoàn toàn logic thật đang test. Mock
// thẳng ở đây (áp dụng cho MỌI test file, không cần khai lại từng nơi)
// — useTranslations(namespace) trả về hàm tra thẳng vào
// src/messages/vi.json theo đúng namespace (hỗ trợ namespace lồng nhau
// kiểu "auth.common"), fallback về chính `key` nếu thiếu — để test hiện
// có (assert thẳng chuỗi tiếng Việt như "Tên Job", "Hủy"...) tiếp tục
// đúng mà KHÔNG cần viết lại. Luôn dùng vi.json (không đọc cookie
// locale) vì test không mô phỏng SSR cookie — đủ cho mục đích test unit
// UI, việc dịch en thật đã có test riêng ở tầng error_code
// (client.test.ts) và sẽ có test riêng cho UI nếu cần re-test theo locale.
jest.mock('next-intl', () => ({
  useTranslations: (namespace) => {
    const ns = namespace
      .split('.')
      .reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), viMessages)
    return (key) => (ns && typeof ns === 'object' && key in ns ? ns[key] : key)
  },
  useLocale: () => 'vi',
}))

// MOCK next-intl/server (thêm khi bắt đầu dịch Server Actions, Giai đoạn
// 2 "me/jobs/contacts/crawl", 09/2026): cùng lý do với mock 'next-intl'
// ở trên (ESM thuần trong node_modules, Jest không transform được) —
// getTranslations() được dùng trong các action 'use server' (actions/
// me.ts, jobs.ts, contacts.ts, crawl.ts...) để dịch fallbackError tĩnh.
// Mock async, tra thẳng vi.json giống hệt useTranslations ở trên, để
// test hiện có (assert message tiếng Việt) không cần viết lại.
jest.mock('next-intl/server', () => ({
  getTranslations: async (namespace) => {
    const ns = namespace
      .split('.')
      .reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), viMessages)
    return (key) => (ns && typeof ns === 'object' && key in ns ? ns[key] : key)
  },
  getLocale: async () => 'vi',
}))

// Mock environment variables
process.env.FASTAPI_URL = 'http://localhost:8000'
process.env.CRAWLER_API_KEY = 'test-api-key'
process.env.JWT_SECRET = 'test-jwt-secret'

// BUG FIX (audit 09/2026 #4): testEnvironment là jest-environment-jsdom
// — jsdom cung cấp AbortSignal RIÊNG của nó (không phải bản Node thật),
// và bản đó KHÔNG có static method timeout() (chỉ Node >= 17.3 mới có,
// jsdom chưa polyfill). Server Actions (actions/auth.ts,
// actions/dashboard.ts) dùng AbortSignal.timeout() để set timeout
// tường minh cho request tới backend (đúng theo REQUEST_TIMEOUT của
// Flask gốc, backend_auth.py) — code này CHẠY THẬT trên Node runtime
// của Next.js server (có AbortSignal.timeout() sẵn), chỉ riêng môi
// trường test jsdom là thiếu. Không polyfill thì MỌI test gọi tới các
// action này sẽ luôn throw "AbortSignal.timeout is not a function"
// ngay từ đầu, che khuất hoàn toàn logic thật đang được test.
if (typeof globalThis.AbortSignal.timeout !== 'function') {
  globalThis.AbortSignal.timeout = (ms) => {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), ms)
    return controller.signal
  }
}
