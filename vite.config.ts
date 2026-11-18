import { defineConfig } from 'vite-plus';

function minifyCssBlock(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}])\s*/g, '$1')
    .replace(/;\s+/g, ';')
    .replace(/;}/g, '}')
    .trim();
}

function compactMinifiedUiTemplates(source: string): string {
  let out = source.replace(
    /(style\.textContent\s*=\s*`)([\s\S]*?)(`;)/g,
    (_m, pre: string, css: string, post: string) => `${pre}${minifyCssBlock(css)}${post}`,
  );
  out = out.replace(
    /(shadow\.innerHTML\s*=\s*`)([\s\S]*?)(`;)/g,
    (_m, pre: string, html: string, post: string) => {
      const compacted = html
        .replace(
          /(<style>)([\s\S]*?)(<\/style>)/g,
          (_sm, sOpen: string, css: string, sClose: string) =>
            `${sOpen}${minifyCssBlock(css)}${sClose}`,
        )
        .replace(/>\s+</g, '><')
        .trim();
      return `${pre}${compacted}${post}`;
    },
  );
  out = out.replace(
    /(tools\.innerHTML\s*=\s*`)([\s\S]*?)(`;)/g,
    (_m, pre: string, html: string, post: string) =>
      `${pre}${html.replace(/>\s+</g, '><').trim()}${post}`,
  );
  return out;
}

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
  fmt: {
    ignorePatterns: ['dist/**', 'CHANGELOG.md'],
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
      plugins: [
        {
          name: 'naizo-compact-ui-templates',
          transform(code: string, id: string) {
            if (!/[\\/]src[\\/]index\.ts$/.test(id)) return null;
            return compactMinifiedUiTemplates(code);
          },
        },
      ],
      outputOptions: {
        entryFileNames: 'naizo.min.js',
      },
    },
  ],
});
