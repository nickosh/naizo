import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const { verifyArtifacts } = createRequire(import.meta.url)('../.github/release-tools/github.cjs');

export function validateSource(commit: string, workflowCommit: string, expected = '') {
  assert.match(commit, /^[a-f0-9]{40}$/);
  assert.equal(
    commit,
    workflowCommit,
    'Run the publishing workflow from the exact version tag for accurate provenance',
  );
  if (expected) {
    assert.match(expected, /^[a-f0-9]{40}$/);
    assert.equal(commit, expected, 'Tag commit differs from expected SHA');
  }
}

type PackedPackage = {
  name: string;
  version: string;
  filename: string;
  integrity: string;
  files: { path: string }[];
};

export function validateReleaseTag(tag: string, version?: string) {
  assert.match(
    tag,
    /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/,
    'Use a stable vMAJOR.MINOR.PATCH tag',
  );
  if (version !== undefined)
    assert.equal(tag, `v${version}`, 'Tag must match package.json version');
}

export function validatePackage(pack: PackedPackage, pkg: { name: string; version: string }) {
  assert.equal(pack.name, pkg.name);
  assert.equal(pack.version, pkg.version);
  assert.equal(pack.filename, `${pkg.name}-${pkg.version}.tgz`);
  assert.match(pack.integrity, /^sha512-[A-Za-z0-9+/]+={0,2}$/);
  assert.deepEqual(
    pack.files.map((file) => file.path).sort(),
    [
      'CHANGELOG.md',
      'LICENSE',
      'README.md',
      'package.json',
      'dist/naka.js',
      'dist/naka.min.js',
      'dist/index.mjs',
      'dist/index.d.mts',
    ].sort(),
    'Package must contain exactly the public distribution files',
  );
}

export async function publicationStatus(pack: PackedPackage, fetchMetadata: typeof fetch = fetch) {
  const url = `https://registry.npmjs.org/${encodeURIComponent(pack.name)}/${encodeURIComponent(pack.version)}`;
  const response = await fetchMetadata(url, { signal: AbortSignal.timeout(30_000) });
  if (response.status === 404) return 'new';
  if (!response.ok) throw new Error(`npm registry check failed: HTTP ${response.status}`);
  const metadata = await response.json();
  assert.equal(metadata.name, pack.name);
  assert.equal(metadata.version, pack.version);
  assert.equal(
    metadata.dist?.integrity,
    pack.integrity,
    'Published version differs from this tarball; do not overwrite or silently skip',
  );
  return 'identical';
}

export async function confirmBootstrap(tag: string, fetchMetadata: typeof fetch = fetch) {
  assert.equal(tag, 'v0.1.0', 'Disabling npm publishing is only allowed for the v0.1.0 bootstrap');
  const response = await fetchMetadata('https://registry.npmjs.org/nakajs/0.1.0', {
    signal: AbortSignal.timeout(30_000),
  });
  assert.ok(response.ok, `npm bootstrap check failed: HTTP ${response.status}`);
  const metadata = await response.json();
  assert.equal(metadata.name, 'nakajs');
  assert.equal(metadata.version, '0.1.0');
  // The local bootstrap tarball may differ from CI; confirm existence without
  // pretending its integrity matches or that this validates OIDC credentials.
  assert.match(metadata.dist?.integrity || '', /^sha512-/);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, argument, workflowCommit, expected] = process.argv.slice(2);
  if (command === 'tag') {
    validateReleaseTag(argument);
  } else if (command === 'version') {
    validateReleaseTag(argument, JSON.parse(readFileSync('package.json', 'utf8')).version);
  } else if (command === 'package') {
    validatePackage(
      JSON.parse(readFileSync(argument, 'utf8'))[0],
      JSON.parse(readFileSync('package.json', 'utf8')),
    );
  } else if (command === 'status') {
    console.log(await publicationStatus(JSON.parse(readFileSync(argument, 'utf8'))[0]));
  } else if (command === 'source') {
    validateSource(argument, workflowCommit, expected);
  } else if (command === 'artifacts') {
    const pack = verifyArtifacts(argument, JSON.parse(readFileSync('package.json', 'utf8')));
    console.log(pack.filename);
  } else if (command === 'bootstrap') {
    await confirmBootstrap(argument);
  } else {
    throw new Error(
      'Expected tag, version, package, status, source, artifacts, or bootstrap command',
    );
  }
}
