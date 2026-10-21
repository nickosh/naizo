// Dependency-free helpers also used by the isolated GitHub asset job.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const stableTag = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const commitSha = /^[a-f0-9]{40}$/;
// Release Please's PR branch for the single root `nakajs` package.
const releaseBranch = 'release-please--branches--main--components--nakajs';
function gh(args) {
  return execFileSync('gh', args, { maxBuffer: 32 * 1024 * 1024 });
}

// The manual first publication must already exist on npm. Its local tarball may
// differ from CI, so confirm existence without comparing integrity; this does
// not validate OIDC credentials.
async function confirmNpmBootstrap(fetchMetadata = fetch) {
  const response = await fetchMetadata('https://registry.npmjs.org/nakajs/0.1.0', {
    signal: AbortSignal.timeout(30_000),
  });
  assert.ok(response.ok, `npm v0.1.0 bootstrap check failed: HTTP ${response.status}`);
  const metadata = await response.json();
  assert.equal(metadata.name, 'nakajs');
  assert.equal(metadata.version, '0.1.0');
  assert.match(metadata.dist?.integrity || '', /^sha512-/);
}
function client(repository = process.env.GITHUB_REPOSITORY, run = gh) {
  assert.match(repository, /^[\w.-]+\/[\w.-]+$/);
  const api = (path) => JSON.parse(run(['api', `repos/${repository}/${path}`]).toString());
  return {
    head: () => {
      const ref = api('git/ref/heads/main');
      assert.equal(ref.ref, 'refs/heads/main');
      assert.equal(ref.object.type, 'commit');
      assert.match(ref.object.sha, commitSha);
      return ref.object.sha;
    },
    releases: () =>
      JSON.parse(
        run([
          'api',
          '--paginate',
          '--slurp',
          `repos/${repository}/releases?per_page=100`,
        ]).toString(),
      ).flat(),
    resolve: (tag) => {
      assert.match(tag, stableTag);
      const ref = api(`git/ref/tags/${encodeURIComponent(tag)}`);
      assert.equal(ref.ref, `refs/tags/${tag}`);
      let object = ref.object;
      for (let depth = 0; object.type === 'tag' && depth < 10; depth++) {
        assert.match(object.sha, commitSha);
        object = api(`git/tags/${object.sha}`).object;
      }
      assert.equal(object.type, 'commit', 'Tag must resolve to a commit');
      assert.match(object.sha, commitSha);
      return object.sha;
    },
    download: (id) =>
      run([
        'api',
        '-H',
        'Accept: application/octet-stream',
        `repos/${repository}/releases/assets/${id}`,
      ]),
    dispatch: (tag, sha) =>
      run([
        'workflow',
        'run',
        'release.yml',
        '--repo',
        repository,
        '--ref',
        tag,
        '-f',
        `tag=${tag}`,
        '-f',
        `expected_sha=${sha}`,
        '-F',
        'publish_npm=true',
      ]),
    upload: (tag, path) => run(['release', 'upload', tag, path, '--repo', repository]),
    create: (tag, sha) =>
      run([
        'release',
        'create',
        tag,
        '--repo',
        repository,
        '--draft',
        '--verify-tag',
        '--target',
        sha,
        '--title',
        tag,
        '--generate-notes',
      ]),
    publish: (tag) => run(['release', 'edit', tag, '--repo', repository, '--draft=false']),
  };
}

function validateSource(tag, actual, expected) {
  assert.match(tag, stableTag, 'Expected a stable vMAJOR.MINOR.PATCH tag');
  assert.match(actual, commitSha, 'Tag must resolve to a full commit SHA');
  assert.match(expected, commitSha, 'Expected a full commit SHA');
  assert.equal(actual, expected, 'Tag commit differs from expected SHA');
}

async function resolveRelease(api, tag, expected) {
  const actual = await api.resolve(tag);
  validateSource(tag, actual, expected || actual);
  const release = (await api.releases()).find((item) => item.tag_name === tag);
  assert.ok(release, 'Existing GitHub release required for recovery/handoff');
  assert.equal(release.prerelease, false, 'Prereleases are not supported');
  // Release Please records the exact SHA. Branch-name metadata on manually
  // created releases is advisory; the immutable tag determines their source.
  if (commitSha.test(release.target_commitish)) {
    assert.equal(release.target_commitish, actual, 'Release target differs from tag commit');
  }
  return { release, sha: actual };
}

async function dispatchRelease(
  api,
  tag,
  expected,
  assertAncestor = (sha) => {
    execFileSync('git', ['merge-base', '--is-ancestor', sha, 'origin/main']);
  },
) {
  const { sha } = await resolveRelease(api, tag, expected);
  assertAncestor(sha);
  await api.dispatch(tag, sha);
  return sha;
}

function verifyArtifacts(directory, pkg) {
  const packs = JSON.parse(readFileSync(path.join(directory, 'pack.json'), 'utf8'));
  assert.ok(Array.isArray(packs) && packs.length === 1, 'Expected a single verified tarball');
  const [pack] = packs;
  assert.equal(pack.name, pkg.name);
  assert.equal(pack.version, pkg.version);
  assert.equal(pack.filename, `${pkg.name}-${pkg.version}.tgz`);
  const tarball = path.join(directory, pack.filename);
  const integrity = `sha512-${createHash('sha512').update(readFileSync(tarball)).digest('base64')}`;
  assert.equal(integrity, pack.integrity, 'Tarball integrity differs from verified manifest');
  for (const name of ['naka.js', 'naka.min.js']) {
    const bundled = execFileSync('tar', ['-xOf', tarball, `package/dist/${name}`]);
    assert.deepEqual(
      readFileSync(path.join(directory, name)),
      bundled,
      `Bundle ${name} differs from tarball`,
    );
  }
  return pack;
}

async function finalizeRelease(api, tag, expected, directory, pack) {
  validateSource(tag, await api.resolve(tag), expected);
  let existing = (await api.releases()).find((item) => item.tag_name === tag);
  if (!existing) {
    await api.create(tag, expected);
  }
  const { release } = await resolveRelease(api, tag, expected);
  const paths = ['naka.js', 'naka.min.js', pack.filename];
  // Compare every existing asset before making any upload, and never clobber.
  for (const name of paths) {
    const asset = release.assets.find((item) => item.name === name);
    if (asset)
      assert.deepEqual(
        await api.download(asset.id),
        readFileSync(path.join(directory, name)),
        `Existing asset ${name} differs; refusing overwrite`,
      );
  }
  for (const name of paths) {
    if (!release.assets.some((item) => item.name === name))
      await api.upload(tag, path.join(directory, name));
  }
  if (release.draft) await api.publish(tag); // Preserve Release Please's title/body.
}

module.exports = {
  client,
  stableTag,
  releaseBranch,
  confirmNpmBootstrap,
  validateSource,
  resolveRelease,
  dispatchRelease,
  verifyArtifacts,
  finalizeRelease,
};
if (require.main === module) {
  (async () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    const pack = verifyArtifacts('release-assets', pkg);
    await finalizeRelease(
      client(),
      process.env.RELEASE_TAG,
      process.env.EXPECTED_SHA,
      'release-assets',
      pack,
    );
  })().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
