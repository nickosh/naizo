import { defineConfig } from 'vite-plus';

export default defineConfig({
  server: {
    port: 3000,
  },
  fmt: {
    ignorePatterns: ['dist/**'],
    singleQuote: true,
    semi: true,
  },
  lint: {
    ignorePatterns: ['dist/**'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
  pack: {
    entry: ['src/index.ts'],
    format: ['iife', 'esm'],
    globalName: 'NakaBundle',
    dts: true,
    outDir: 'dist',
  },
});
