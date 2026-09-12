import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // jest.config.js BẮT BUỘC dùng require() (CommonJS) — Jest tự load
    // file này trước khi có ESM transform sẵn sàng, next/jest chính
    // thức cũng dùng đúng pattern require(next/jest) này. Không đổi
    // sang import được nên tắt riêng rule cho đúng 1 file này.
    files: ["jest.config.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
