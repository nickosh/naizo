// Release Please owns versioning; this adapter controls when preparation occurs.
const assert = require('node:assert/strict');
const { appendFileSync, readFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { GitHub, Manifest } = require('release-please');
const { client, stableTag, dispatchRelease, confirmNpmBootstrap } = require('./github.cjs');

function describeCommits(github) {
  const create = github.createPullRequest.bind(github);
  github.createPullRequest = (pr, branch, subject, updates, options) =>
    create(
      pr,
      branch,
      `${subject}\n\nUpdate the package version, release manifest, changelog, and generated browser bundle for the reviewed release.\nMerging this preparation starts verification and npm Trusted Publishing.`,
      updates,
      options,
    );
  github.updatePullRequest = async (number, releasePr, branch, options) => {
    const body = await options.pullRequestOverflowHandler.handleOverflow(releasePr);
    return github.createPullRequest(
      {
        number,
        title: releasePr.title.toString(),
        body,
        headBranchName: releasePr.headRefName,
        baseBranchName: branch,
        labels: releasePr.labels,
        files: [],
      },
      branch,
      releasePr.title.toString(),
      releasePr.updates,
      options,
    );
  };
  return github;
}

function guardWrites(github, assertSource) {
  const create = github.createPullRequest.bind(github);
  github.createPullRequest = async (...args) => {
    await assertSource();
    const pr = await create(...args);
    await assertSource();
    return pr;
  };
  return github;
}

function pushMessages(event, cwd = process.cwd()) {
  assert.ok(
    [event.before, event.after].every((sha) => /^[a-f0-9]{40}$/.test(sha)),
    'Push event must identify its before and after commits',
  );
  // A newly created branch introduces all history reachable from its tip.
  const args = /^0+$/.test(event.before) ? [event.after] : [`${event.before}..${event.after}`];
  return execFileSync('git', ['log', '--format=%B%x00', ...args, '--'], { cwd, encoding: 'utf8' })
    .split('\0')
    .map((message) => message.trim())
    .filter(Boolean);
}

function hasReleaseRequest(messages) {
  // Any Release-As footer line explicitly requests preparation. Release Please
  // itself decides whether the footer affects the proposed version; avoid its
  // internal commit parser so updater upgrades cannot silently break triggers.
  let requested = false;
  for (const message of messages) {
    for (const match of message.matchAll(/^release-as:\s*(.*)$/gim)) {
      assert.match(
        `v${match[1].trim()}`,
        stableTag,
        'Release-As must specify a stable version such as 0.2.0',
      );
      requested = true;
    }
  }
  return requested;
}

function shouldPrepareRelease(name, event, readMessages = pushMessages) {
  if (name === 'workflow_dispatch') return true;
  return name === 'push' && hasReleaseRequest(readMessages(event));
}

function guardManifest(manifest, bundle) {
  if (bundle !== undefined) assert.ok(bundle.trim(), 'Prepared browser bundle must not be empty');
  const build = manifest.buildPullRequests.bind(manifest);
  manifest.buildPullRequests = async () => {
    const candidates = await build();
    for (const pr of candidates) {
      assert.equal(pr.body.releaseData.length, 1, 'Expected one root package');
      assert.match(
        `v${pr.body.releaseData[0].version}`,
        stableTag,
        'Release Please must propose a stable version; correct any Release-As footer',
      );
      if (bundle !== undefined) {
        assert.ok(
          !pr.updates.some((update) => update.path === 'dist/naka.js'),
          'Duplicate bundle updater',
        );
        pr.updates.push({
          path: 'dist/naka.js',
          createIfMissing: true,
          updater: { updateContent: () => bundle },
        });
      }
    }
    return candidates;
  };
  return manifest;
}

async function requireBootstrap(releases, fetchMetadata = fetch) {
  assert.ok(
    releases.some(
      (release) => release.tag_name === 'v0.1.0' && !release.draft && !release.prerelease,
    ),
    'Complete the manual v0.1.0 npm/GitHub bootstrap first; see docs/PUBLISHING.md',
  );
  await confirmNpmBootstrap(fetchMetadata);
}

async function preparePullRequests(manifest) {
  const prs = await manifest.createPullRequests();
  if (!prs.filter(Boolean).length) console.log('No releasable changes; no release PR prepared.');
}

async function assertPreparationSource(
  api,
  expected,
  checkout = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
) {
  assert.match(expected, /^[a-f0-9]{40}$/, 'Expected the full prepared source SHA');
  assert.equal(checkout, expected, 'Checkout differs from the bundle source commit');
  assert.equal(
    await api.head(),
    expected,
    'main advanced during release preparation; explicitly refresh the release PR before merging',
  );
}

async function planPreparation(manifest, assertSource, writeOutput, source) {
  await assertSource();
  const candidates = await manifest.buildPullRequests();
  if (!candidates.length) {
    console.log('No releasable changes; no release PR prepared.');
    return;
  }
  assert.equal(candidates.length, 1, 'Expected one root release PR');
  await assertSource();
  writeOutput(`prepare=true\nsource_sha=${source}\n`);
}

async function maintainRelease(manifest, requested, prepare = preparePullRequests) {
  const releases = (await manifest.createReleases()).filter(Boolean);
  assert.ok(releases.length <= 1, 'Expected one root package release');
  if (!releases.length && requested) {
    await prepare(manifest);
  } else if (!releases.length) console.log('Ordinary push: release PR left unchanged.');
  return releases;
}

async function run({
  api,
  recoveryTag,
  requested,
  getManifest,
  bootstrap = requireBootstrap,
  dispatch = dispatchRelease,
  prepare = preparePullRequests,
  prepareOnly = false,
}) {
  if (recoveryTag) return dispatch(api, recoveryTag);
  const existing = await api.releases();
  const draft = existing.find((release) => release.draft && stableTag.test(release.tag_name));
  if (draft) {
    assert.ok(
      !requested,
      `Unfinished draft ${draft.tag_name}; recover it with release_tag before preparing another release`,
    );
    console.log(`Unfinished draft ${draft.tag_name}; use release_tag to recover publication.`);
    return;
  }
  // Ordinary pushes before bootstrap are harmless and must not prepare PRs.
  if (!existing.some((release) => release.tag_name === 'v0.1.0' && !release.draft)) {
    if (requested) await bootstrap(existing);
    return;
  }
  await bootstrap(existing);
  const manifest = await getManifest();
  if (prepareOnly) {
    assert.ok(requested, 'PR preparation requires an explicit request');
    await prepare(manifest);
    return;
  }
  const releases = await maintainRelease(manifest, requested, prepare);
  if (releases.length) await dispatch(api, releases[0].tagName, releases[0].sha);
}

async function main() {
  const mode = process.argv[2];
  assert.ok(['check', 'prepare'].includes(mode), 'Expected check or prepare mode');
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main', 'Run preparation on main');
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const recoveryTag = process.env.RELEASE_TAG || '';
  if (recoveryTag) assert.match(recoveryTag, stableTag);
  const requested = !recoveryTag && shouldPrepareRelease(process.env.GITHUB_EVENT_NAME, event);
  const api = client();
  const source =
    mode === 'check'
      ? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
      : process.env.SOURCE_SHA;
  const assertSource = () => assertPreparationSource(api, source);
  let bundle;
  if (mode === 'prepare') {
    assert.ok(requested && !recoveryTag, 'PR preparation requires an explicit request');
    await assertSource();
    bundle = readFileSync(process.env.BUNDLE_PATH, 'utf8');
  }
  await run({
    api,
    recoveryTag,
    requested,
    prepareOnly: mode === 'prepare',
    prepare:
      mode === 'check'
        ? (manifest) =>
            planPreparation(
              manifest,
              assertSource,
              (output) => appendFileSync(process.env.GITHUB_OUTPUT, output),
              source,
            )
        : async (manifest) => {
            await assertSource();
            await preparePullRequests(manifest);
            await assertSource();
          },
    getManifest: async () => {
      const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
      const github = describeCommits(
        await GitHub.create({ owner, repo, token: process.env.GH_TOKEN }),
      );
      // Check both sides of each write to detect main advancing while the API
      // is reading or updating the release branch. A failed refresh is not ready to merge.
      if (mode === 'prepare') {
        guardWrites(github, assertSource);
      }
      return guardManifest(await Manifest.fromManifest(github, 'main'), bundle);
    },
  });
}
module.exports = {
  describeCommits,
  guardWrites,
  pushMessages,
  hasReleaseRequest,
  shouldPrepareRelease,
  guardManifest,
  assertPreparationSource,
  planPreparation,
  requireBootstrap,
  maintainRelease,
  run,
};
if (require.main === module)
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
