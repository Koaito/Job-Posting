/**
 * BUG FIX (audit 09/2026): jest.setup.js đã `import '@testing-library/jest-dom'`
 * lúc chạy test (runtime OK, jest chạy đúng — 34/34 test pass), nhưng
 * `tsc`/`next build` type-check KHÔNG đi qua jest.setup.js (không nằm
 * trong "type" của bất kỳ file .ts/.tsx nào), nên compiler không biết
 * jest-dom đã mở rộng interface Matchers (toBeInTheDocument,
 * toHaveTextContent, toBeDisabled, toHaveAttribute...) — khiến
 * `next build` fail ở bước "Running TypeScript" dù test chạy thật vẫn
 * xanh. File .d.ts này import side-effect để đưa module augmentation
 * đó vào chương trình TypeScript (tsconfig include mọi file .ts trong
 * src, tự nhặt file này), không cần .ts nào khác tự import lại.
 */
import '@testing-library/jest-dom';
