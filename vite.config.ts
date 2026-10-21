import { defineConfig } from 'vite-plus';

export default defineConfig({
  plugins: [
    {
      name: 'naizo-site-root',
      configureServer(server) {
        server.middlewares.use((req: { url?: string }, _res: unknown, next: () => void) => {
          if (req.url === '/' || req.url === '/index.html') {
            req.url = '/site/index.html';
          }
          next();
        });
      },
    },
  ],
  server: {
    port: 3000,
    open: '/site/index.html',
  },
  build: {
    outDir: 'dist/site',
    rollupOptions: {
      input: 'site/index.html',
    },
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
  pack: [
    {
      entry: { index: 'src/index.ts' },
      format: ['esm'],
      fixedExtension: true,
      dts: true,
      outDir: 'dist',
    },
    {
      entry: { naizo: 'src/iife.ts' },
      format: ['iife'],
      platform: 'browser',
      dts: false,
      outDir: 'dist',
      outputOptions: {
        entryFileNames: 'naizo.js',
      },
    },
    {
      entry: { 'naizo.min': 'src/iife.ts' },
      format: ['iife'],
      platform: 'browser',
      dts: false,
      minify: true,
      outDir: 'dist',
      outputOptions: {
        entryFileNames: 'naizo.min.js',
      },
    },
  ],
});
