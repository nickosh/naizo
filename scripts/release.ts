import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const { verifyArtifacts, stableTag, confirmNpmBootstrap, client } = createRequire(import.meta.url)(
  '../.github/release-tools/github.cjs',
);

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
  assert.match(tag, stableTag, 'Use a stable vMAJOR.MINOR.PATCH tag');
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
      'dist/naizo.js',
      'dist/naizo.min.js',
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
  await confirmNpmBootstrap(fetchMetadata);
}

type GitHubReleaseSummary = {
  tag_name: string;
  draft?: boolean;
  prerelease?: boolean;
};

function compareStableTagsDesc(a: string, b: string): number {
  const parse = (tag: string) => {
    const match = stableTag.exec(tag);
    assert.ok(match, `Invalid stable tag: ${tag}`);
    return [Number(match[1]), Number(match[2]), Number(match[3])] as const;
  };
  const [aMaj, aMin, aPat] = parse(a);
  const [bMaj, bMin, bPat] = parse(b);
  return bMaj - aMaj || bMin - aMin || bPat - aPat;
}

export function latestReleaseTag(releases: GitHubReleaseSummary[]): string {
  const published = releases
    .filter((release) => !release.draft && !release.prerelease && stableTag.test(release.tag_name))
    .map((release) => release.tag_name)
    .sort(compareStableTagsDesc);
  assert.ok(published.length > 0, 'No published stable GitHub Release found');
  return published[0]!;
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
  } else if (command === 'latest-tag') {
    console.log(latestReleaseTag(await client().releases()));
  } else {
    throw new Error(
      'Expected tag, version, package, status, source, artifacts, bootstrap, or latest-tag command',
    );
  }
}
