// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';
import {
  publicationStatus,
  validatePackage,
  validateReleaseTag,
  validateSource,
  confirmBootstrap,
  latestReleaseTag,
} from '../scripts/release';

const pack = {
  name: 'naizojs',
  version: '0.1.0',
  filename: 'naizojs-0.1.0.tgz',
  integrity: 'sha512-YWJjZA==',
  files: [
    'CHANGELOG.md',
    'LICENSE',
    'README.md',
    'package.json',
    'dist/naizo.js',
    'dist/naizo.min.js',
    'dist/index.mjs',
    'dist/index.d.mts',
  ].map((path) => ({ path })),
};

describe('release guards', () => {
  it('permits the no-publish bootstrap only after npm v0.1.0 exists', async () => {
    const metadata = { name: 'naizojs', version: '0.1.0', dist: { integrity: 'sha512-YWJj' } };
    await expect(
      confirmBootstrap('v0.1.0', async () => Response.json(metadata)),
    ).resolves.toBeUndefined();
    await expect(confirmBootstrap('v0.2.0', async () => Response.json(metadata))).rejects.toThrow(
      'only allowed',
    );
    await expect(
      confirmBootstrap('v0.1.0', async () => new Response(null, { status: 404 })),
    ).rejects.toThrow('HTTP 404');
    await expect(
      confirmBootstrap('v0.1.0', async () => Response.json({ ...metadata, version: '0.2.0' })),
    ).rejects.toThrow();
  });
  it('rejects workflow/tag/expected SHA mismatches', () => {
    const sha = 'a'.repeat(40);
    expect(() => validateSource(sha, sha, sha)).not.toThrow();
    expect(() => validateSource(sha, sha)).not.toThrow();
    expect(() => validateSource(sha, 'b'.repeat(40))).toThrow();
    expect(() => validateSource(sha, sha, 'b'.repeat(40))).toThrow();
    expect(() => validateSource(sha, sha, 'main')).toThrow();
  });
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

  it('ignores Release Please generated CHANGELOG.md in vite.config.ts fmt.ignorePatterns', () => {
    const viteConfig = readFileSync('vite.config.ts', 'utf8');
    expect(viteConfig).toMatch(/ignorePatterns:\s*\[\s*'dist\/\*\*'\s*,\s*'CHANGELOG\.md'\s*\]/);
  });

  it('selects the highest published stable release tag for Pages latest-release and skips drafts/prereleases (M7.12, D49)', () => {
    expect(
      latestReleaseTag(
        [
          { tag_name: 'v0.1.0', draft: false, prerelease: false },
          { tag_name: 'v0.2.0', draft: false, prerelease: false },
          { tag_name: 'v0.3.0', draft: true, prerelease: false },
          { tag_name: 'v0.4.0-rc.1', draft: false, prerelease: true },
          { tag_name: 'v0.5.0-beta.1', draft: false, prerelease: false },
        ],
        '0.3.0',
      ),
    ).toBe('v0.2.0');

    // Numeric semver comparison (v0.10.0 > v0.9.0) and manual tagged releases higher than manifest
    expect(
      latestReleaseTag(
        [
          { tag_name: 'v0.9.0', draft: false, prerelease: false },
          { tag_name: 'v0.10.0', draft: false, prerelease: false },
          { tag_name: 'v0.2.0', draft: false, prerelease: false },
        ],
        '0.9.0',
      ),
    ).toBe('v0.10.0');

    // Falls back to .release-please-manifest.json only when zero GitHub Releases exist
    expect(latestReleaseTag([], '0.2.0')).toBe('v0.2.0');

    // Rejects when only unpublished drafts/prereleases exist or when fallback manifest is invalid
    expect(() =>
      latestReleaseTag([{ tag_name: 'v0.1.0', draft: true, prerelease: false }], '0.1.0'),
    ).toThrow('No published stable GitHub Release found');
    expect(() => latestReleaseTag([], '0.2.0-rc.1')).toThrow();
    expect(() => latestReleaseTag([])).toThrow('No published stable GitHub Release found');

    // End-to-end CLI invocation of `scripts/release.ts latest-tag` with mocked gh binary
    const mockBinDir = mkdtempSync(join(tmpdir(), 'naizo-gh-mock-'));
    try {
      const mockGhPath = join(mockBinDir, 'gh');
      writeFileSync(
        mockGhPath,
        `#!/bin/sh\nprintf '%s\\n' '[[{"tag_name":"v0.1.0","draft":false,"prerelease":false},{"tag_name":"v0.2.0","draft":false,"prerelease":false},{"tag_name":"v0.3.0","draft":true,"prerelease":false}]]'\n`,
      );
      chmodSync(mockGhPath, 0o755);
      const cliOut = execFileSync(process.execPath, ['scripts/release.ts', 'latest-tag'], {
        encoding: 'utf8',
        env: {
          ...process.env,
          GITHUB_REPOSITORY: 'nickosh/naizo',
          PATH: `${mockBinDir}:${process.env.PATH ?? ''}`,
        },
      }).trim();
      expect(cliOut).toBe('v0.2.0');
    } finally {
      rmSync(mockBinDir, { recursive: true, force: true });
    }
  });
});
