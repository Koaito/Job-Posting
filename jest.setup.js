// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

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
