// @vitest-environment node
import { describe, expect, it } from 'vite-plus/test';
import { publicationStatus, validatePackage, validateReleaseTag } from '../scripts/release';

const pack = {
  name: 'nakajs',
  version: '0.1.0',
  filename: 'nakajs-0.1.0.tgz',
  integrity: 'sha512-YWJjZA==',
  files: [
    'LICENSE',
    'README.md',
    'package.json',
    'dist/naka.js',
    'dist/naka.min.js',
    'dist/index.mjs',
    'dist/index.d.mts',
  ].map((path) => ({ path })),
};

describe('release guards', () => {
  it('accepts the exact stable package version and rejects mismatches and unsafe refs', () => {
    expect(() => validateReleaseTag('v0.1.0', '0.1.0')).not.toThrow();
    for (const tag of ['v0.2.0', 'main', 'v01.1.0', 'v0.1.0-beta.1', 'v0.1.0; echo unsafe']) {
      expect(() => validateReleaseTag(tag, '0.1.0')).toThrow();
    }
  });

  it('rejects missing bundles and accidental private or site files in the npm tarball', () => {
    expect(() => validatePackage(pack, pack)).not.toThrow();
    expect(() => validatePackage({ ...pack, files: pack.files.slice(1) }, pack)).toThrow();
    for (const path of ['.npmrc', 'AGENTS.md', 'dist/site/index.html']) {
      expect(() => validatePackage({ ...pack, files: [...pack.files, { path }] }, pack)).toThrow();
    }
  });

  it('allows a new version only on a registry 404', async () => {
    expect(await publicationStatus(pack, async () => new Response(null, { status: 404 }))).toBe(
      'new',
    );
    for (const status of [401, 403, 429, 500, 503]) {
      await expect(
        publicationStatus(pack, async () => new Response(null, { status })),
      ).rejects.toThrow(`HTTP ${status}`);
    }
    await expect(
      publicationStatus(pack, async () => {
        throw new Error('offline');
      }),
    ).rejects.toThrow('offline');
  });

  it('allows retries only when the existing registry version has identical integrity', async () => {
    const metadata = {
      name: pack.name,
      version: pack.version,
      dist: { integrity: pack.integrity },
    };
    expect(await publicationStatus(pack, async () => Response.json(metadata))).toBe('identical');
    await expect(
      publicationStatus(pack, async () =>
        Response.json({ ...metadata, dist: { integrity: 'different' } }),
      ),
    ).rejects.toThrow('Published version differs');
    await expect(
      publicationStatus(pack, async () => Response.json({ ...metadata, version: '0.2.0' })),
    ).rejects.toThrow();
    await expect(
      publicationStatus(pack, async () => new Response('invalid json')),
    ).rejects.toThrow();
  });
});
