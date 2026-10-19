// Release Please owns versioning; this adapter controls when preparation occurs.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { GitHub, Manifest } = require('release-please');
const { parseConventionalCommits } = require('release-please/build/src/commit');
const { client, stableTag, dispatchRelease } = require('./github.cjs');

function describeCommits(github) {
  const create = github.createPullRequest.bind(github);
  github.createPullRequest = (pr, branch, subject, updates, options) =>
    create(
      pr,
      branch,
      `${subject}\n\nUpdate the package version, release manifest, and changelog for the reviewed release.\nMerging this preparation starts verification and npm Trusted Publishing.`,
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
  // Reject malformed requests even if a non-Conventional subject is ignored by
  // the parser; use the actual updater's parser to recognize valid footers.
  for (const message of messages) {
    for (const match of message.matchAll(/^release-as:\s*(.*)$/gim)) {
      assert.match(
        `v${match[1].trim()}`,
        stableTag,
        'Release-As must specify a stable version such as 0.2.0',
      );
    }
  }
  const requests = parseConventionalCommits(messages.map((message) => ({ message, sha: '' })))
    .flatMap((commit) => commit.notes)
    .filter((note) => note.title === 'RELEASE AS');
  for (const request of requests)
    assert.match(
      `v${request.text}`,
      stableTag,
      'Release-As must specify a stable version such as 0.2.0',
    );
  return requests.length > 0;
}

function shouldPrepareRelease(name, event, readMessages = pushMessages) {
  if (name === 'workflow_dispatch') return true;
  return name === 'push' && hasReleaseRequest(readMessages(event));
}

function guardManifest(manifest) {
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
  const response = await fetchMetadata('https://registry.npmjs.org/nakajs/0.1.0', {
    signal: AbortSignal.timeout(30_000),
  });
  assert.ok(response.ok, `npm v0.1.0 bootstrap check failed: HTTP ${response.status}`);
  const metadata = await response.json();
  assert.equal(metadata.name, 'nakajs');
  assert.equal(metadata.version, '0.1.0');
  assert.match(metadata.dist?.integrity || '', /^sha512-/);
}

async function maintainRelease(manifest, requested) {
  const releases = (await manifest.createReleases()).filter(Boolean);
  assert.ok(releases.length <= 1, 'Expected one root package release');
  if (!releases.length && requested) {
    const prs = await manifest.createPullRequests();
    if (!prs.filter(Boolean).length) console.log('No releasable changes; no release PR prepared.');
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
  const releases = await maintainRelease(await getManifest(), requested);
  if (releases.length) await dispatch(api, releases[0].tagName, releases[0].sha);
}

async function main() {
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main', 'Run preparation on main');
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const recoveryTag = process.env.RELEASE_TAG || '';
  if (recoveryTag) assert.match(recoveryTag, stableTag);
  const requested = !recoveryTag && shouldPrepareRelease(process.env.GITHUB_EVENT_NAME, event);
  await run({
    api: client(),
    recoveryTag,
    requested,
    getManifest: async () => {
      const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
      const github = describeCommits(
        await GitHub.create({ owner, repo, token: process.env.GH_TOKEN }),
      );
      return guardManifest(await Manifest.fromManifest(github, 'main'));
    },
  });
}
module.exports = {
  describeCommits,
  pushMessages,
  hasReleaseRequest,
  shouldPrepareRelease,
  guardManifest,
  requireBootstrap,
  maintainRelease,
  run,
};
if (require.main === module)
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
