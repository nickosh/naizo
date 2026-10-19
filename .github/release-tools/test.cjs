const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  readFileSync,
  writeFileSync,
  mkdtempSync,
  rmSync,
  mkdirSync,
  existsSync,
} = require('node:fs');
const path = require('node:path');
const { tmpdir } = require('node:os');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { Manifest } = require('release-please');
const {
  describeCommits,
  pushMessages,
  hasReleaseRequest,
  shouldPrepareRelease,
  guardManifest,
  requireBootstrap,
  maintainRelease,
  run,
} = require('./run.cjs');
const {
  client,
  validateSource,
  resolveRelease,
  dispatchRelease,
  verifyArtifacts,
  finalizeRelease,
} = require('./github.cjs');
const root = path.resolve(__dirname, '../..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const sha = 'a'.repeat(40);
const oldSha = 'b'.repeat(40);
const request = 'chore: prepare release\n\nPrepare the next reviewed package.\n\nRelease-As: 0.2.0';
const baseline = { tag_name: 'v0.1.0', draft: false, prerelease: false };
const draft = {
  tag_name: 'v0.2.0',
  draft: true,
  prerelease: false,
  target_commitish: sha,
  assets: [],
};

for (const [message, expected] of [
  ['fix: preserve fields', '0.1.1'],
  ['feat: add bindings', '0.2.0'],
  ['fix!: change binding contract\n\nBREAKING CHANGE: inputs use the new contract.', '0.2.0'],
  [request, '0.2.0'],
  [request.replace('0.2.0', '1.0.0'), '1.0.0'],
  [request.replace('0.2.0', '0.2.0-rc.1'), 'reject'],
  ['docs: clarify examples', null],
]) {
  void test(`actual pinned Manifest updater: ${message.split('\n')[0]}`, async () => {
    const github = {
      repository: { owner: 'nickosh', repo: 'nakajs', defaultBranch: 'main' },
      getFileJson: async (path) => JSON.parse(read(path)),
      getFileContentsOnBranch: async (path) => ({ parsedContent: read(path) }),
      findFilesByFilenameAndRef: async () => [],
      releaseIterator: async function* () {
        yield { tagName: 'v0.1.0', sha: oldSha, notes: '' };
      },
      mergeCommitIterator: async function* () {
        yield { sha, message, files: ['src/index.ts'] };
        yield { sha: oldSha, message: 'chore: baseline', files: [] };
      },
      pullRequestIterator: async function* () {},
    };
    const manifest = guardManifest(await Manifest.fromManifest(github, 'main'));
    assert.equal(manifest.repositoryConfig['.'].draft, true);
    assert.equal(manifest.repositoryConfig['.'].forceTag, true);
    assert.equal(manifest.repositoryConfig['.'].includeComponentInTag, false);
    assert.equal(manifest.repositoryConfig['.'].includeVInTag, true);
    if (expected === 'reject') {
      await assert.rejects(manifest.buildPullRequests(), /stable version/);
      return;
    }
    const candidates = await manifest.buildPullRequests();
    if (!expected) {
      assert.equal(candidates.length, 0);
      return;
    }
    assert.equal(candidates.length, 1);
    const pr = candidates[0];
    const outputs = new Map(
      pr.updates
        .filter((update) => existsSync(path.join(root, update.path)))
        .map((update) => [update.path, update.updater.updateContent(read(update.path))]),
    );
    assert.equal(JSON.parse(outputs.get('package.json')).version, expected);
    assert.equal(JSON.parse(outputs.get('.release-please-manifest.json'))['.'], expected);
    assert.ok(outputs.get('CHANGELOG.md').includes(expected));
    assert.ok(outputs.get('CHANGELOG.md').includes('## 0.1.0'));
    assert.ok(!outputs.has('.github/release-tools/package.json'));
    // Verify installed implementation, not a mocked version algorithm.
    assert.equal(require('release-please/package.json').version, '17.11.2');
  });
}

void test('creation and refresh retain descriptive Conventional Commit bodies', async () => {
  const calls = [];
  const github = describeCommits({ createPullRequest: async (...args) => calls.push(args) });
  await github.createPullRequest({}, 'main', 'chore(main): release 0.2.0', [], {});
  await github.updatePullRequest(
    7,
    { title: 'chore(main): release 0.2.0', headRefName: 'release', labels: [], updates: [] },
    'main',
    { pullRequestOverflowHandler: { handleOverflow: async () => 'Original notes' } },
  );
  assert.equal(calls.length, 2);
  for (const args of calls)
    assert.match(args[2], /^chore\(main\): release 0\.2\.0\n\nUpdate the package.*\nMerging/);
  assert.equal(calls[1][0].number, 7);
  assert.equal(calls[1][0].body, 'Original notes');
});

void test('only manual preparation or a valid Conventional Commit footer prepares', () => {
  assert.equal(
    hasReleaseRequest(['fix: repair input', 'feat: add binding', 'docs: explain']),
    false,
  );
  assert.equal(hasReleaseRequest([request]), true);
  assert.equal(hasReleaseRequest([request.replace('Release-As', 'release-as')]), true);
  assert.equal(hasReleaseRequest(['feat: later', request, 'fix: latest']), true);
  for (const value of [
    '0.2.0-beta.1',
    '0.2.0+build.1',
    '01.2.0',
    'v0.2.0',
    '',
    '0.2',
    '0.2.0; unsafe',
  ]) {
    assert.throws(() => hasReleaseRequest([request.replace('0.2.0', value)]), /stable version/);
  }
  const unread = () => {
    throw new Error('Unexpected history read');
  };
  assert.equal(shouldPrepareRelease('workflow_dispatch', {}, unread), true);
  assert.equal(shouldPrepareRelease('pull_request', {}, unread), false);
  assert.equal(
    shouldPrepareRelease('push', {}, () => [request]),
    true,
  );
  assert.equal(
    shouldPrepareRelease('push', {}, () => ['feat: normal']),
    false,
  );
});

void test('push parsing excludes old footers, includes the entire pushed range, and handles a new branch', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'naka-push-'));
  const git = (...args) =>
    execFileSync(
      'git',
      [
        '-c',
        'user.name=Release test',
        '-c',
        'user.email=test@example.invalid',
        '-c',
        'commit.gpgsign=false',
        ...args,
      ],
      { cwd: directory, encoding: 'utf8' },
    ).trim();
  try {
    git('init', '-q');
    git('commit', '--allow-empty', '-qm', request);
    const before = git('rev-parse', 'HEAD');
    git('commit', '--allow-empty', '-qm', 'fix: ordinary');
    const ordinary = git('rev-parse', 'HEAD');
    assert.equal(hasReleaseRequest(pushMessages({ before, after: ordinary }, directory)), false);
    assert.equal(
      hasReleaseRequest(pushMessages({ before: '0'.repeat(40), after: ordinary }, directory)),
      true,
    );
    git('commit', '--allow-empty', '-qm', request);
    git('commit', '--allow-empty', '-qm', 'fix: last in batch');
    assert.equal(
      hasReleaseRequest(
        pushMessages({ before: ordinary, after: git('rev-parse', 'HEAD') }, directory),
      ),
      true,
    );
    assert.throws(() => pushMessages({ before: 'main', after: sha }, directory));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

void test('ordinary pushes leave PRs untouched, explicit no-op requests succeed, merged PRs hand off', async () => {
  let checks = 0;
  let preparations = 0;
  const manifest = {
    createReleases: async () => {
      checks++;
      return [];
    },
    createPullRequests: async () => {
      preparations++;
      return [];
    },
  };
  await maintainRelease(manifest, false);
  assert.equal(preparations, 0);
  await maintainRelease(manifest, true);
  assert.equal(checks, 2);
  assert.equal(preparations, 1);
  manifest.createReleases = async () => [{ tagName: 'v0.2.0', sha }];
  assert.deepEqual(await maintainRelease(manifest, false), [{ tagName: 'v0.2.0', sha }]);
  assert.equal(preparations, 1);
});

void test('bootstrap requires both the public GitHub release and exact npm package', async () => {
  const ok = async () =>
    Response.json({ name: 'nakajs', version: '0.1.0', dist: { integrity: 'sha512-YWJj' } });
  await requireBootstrap([baseline], ok);
  await assert.rejects(requireBootstrap([], ok), /bootstrap first/);
  await assert.rejects(requireBootstrap([{ ...baseline, draft: true }], ok));
  for (const status of [404, 403, 500])
    await assert.rejects(requireBootstrap([baseline], async () => new Response(null, { status })));
  await assert.rejects(requireBootstrap([baseline], async () => Response.json({ name: 'other' })));
});

void test('unfinished drafts block preparation, ordinary pushes wait, recovery bypasses preparation', async () => {
  let dispatches = 0;
  const options = {
    api: { releases: async () => [baseline, draft] },
    getManifest: async () => {
      throw new Error('Must not touch PRs');
    },
    dispatch: async (api, tag) => {
      assert.equal(tag, draft.tag_name);
      dispatches++;
    },
  };
  await assert.rejects(run({ ...options, requested: true }), /release_tag/);
  await run({ ...options, requested: false });
  assert.equal(dispatches, 0);
  await run({ ...options, requested: false, recoveryTag: 'v0.2.0' });
  assert.equal(dispatches, 1);
});

void test('merged release handoff forwards exact tag and SHA; bootstrap absence is harmless on ordinary pushes', async () => {
  const dispatches = [];
  const options = {
    api: { releases: async () => [baseline] },
    bootstrap: async () => {},
    getManifest: async () => ({ createReleases: async () => [{ tagName: 'v0.2.0', sha }] }),
    dispatch: async (...args) => dispatches.push(args),
  };
  await run({ ...options, requested: false });
  assert.deepEqual(dispatches[0].slice(1), ['v0.2.0', sha]);
  await run({ ...options, api: { releases: async () => [] }, requested: false });
  assert.equal(dispatches.length, 1);
});

void test('recovery checks tag, existing release, SHA, target, and ancestry before dispatch', async () => {
  const calls = [];
  const api = {
    resolve: async () => sha,
    releases: async () => [draft],
    dispatch: async (...args) => calls.push(args),
  };
  await dispatchRelease(api, 'v0.2.0', sha, (value) => assert.equal(value, sha));
  assert.deepEqual(calls, [['v0.2.0', sha]]);
  assert.throws(() => validateSource('v0.2.0-rc.1', sha, sha));
  await assert.rejects(resolveRelease(api, 'v0.2.0', oldSha), /expected SHA/);
  await assert.rejects(resolveRelease({ ...api, releases: async () => [] }, 'v0.2.0', sha));
  await assert.rejects(
    resolveRelease(
      { ...api, releases: async () => [{ ...draft, target_commitish: oldSha }] },
      'v0.2.0',
      sha,
    ),
  );
  await assert.rejects(
    dispatchRelease(api, 'v0.2.0', sha, () => {
      throw new Error('not on main');
    }),
    /not on main/,
  );
  assert.equal(calls.length, 1);
});

void test('GitHub client explicitly dispatches release.yml at the tag with expected SHA', () => {
  const calls = [];
  client('nickosh/nakajs', (args) => {
    calls.push(args);
    return Buffer.from('');
  }).dispatch('v0.2.0', sha);
  assert.deepEqual(calls[0], [
    'workflow',
    'run',
    'release.yml',
    '--repo',
    'nickosh/nakajs',
    '--ref',
    'v0.2.0',
    '-f',
    'tag=v0.2.0',
    '-f',
    `expected_sha=${sha}`,
    '-F',
    'publish_npm=true',
  ]);
});

void test('tag resolution explicitly uses tag refs and peels annotated tags', () => {
  const calls = [];
  const api = client('nickosh/nakajs', (args) => {
    calls.push(args);
    const response = args[1].includes('/git/ref/tags/')
      ? { ref: 'refs/tags/v0.2.0', object: { type: 'tag', sha: oldSha } }
      : { object: { type: 'commit', sha } };
    return Buffer.from(JSON.stringify(response));
  });
  assert.equal(api.resolve('v0.2.0'), sha);
  assert.equal(calls[0][1], 'repos/nickosh/nakajs/git/ref/tags/v0.2.0');
  assert.equal(calls[1][1], `repos/nickosh/nakajs/git/tags/${oldSha}`);
  assert.throws(() => api.resolve('main'));
  assert.equal(calls.length, 2);
  const invalid = client('nickosh/nakajs', () =>
    Buffer.from(
      JSON.stringify({
        ref: 'refs/tags/v0.2.0',
        object: { type: 'tree', sha },
      }),
    ),
  );
  assert.throws(() => invalid.resolve('v0.2.0'), /resolve to a commit/);
});

function artifacts() {
  const directory = mkdtempSync(path.join(tmpdir(), 'naka-assets-'));
  mkdirSync(path.join(directory, 'package/dist'), { recursive: true });
  for (const name of ['naka.js', 'naka.min.js']) {
    writeFileSync(path.join(directory, name), name);
    writeFileSync(path.join(directory, 'package/dist', name), name);
  }
  const filename = 'nakajs-0.2.0.tgz';
  execFileSync('tar', ['-czf', path.join(directory, filename), '-C', directory, 'package']);
  const pack = {
    name: 'nakajs',
    version: '0.2.0',
    filename,
    integrity: `sha512-${createHash('sha512')
      .update(readFileSync(path.join(directory, filename)))
      .digest('base64')}`,
  };
  writeFileSync(path.join(directory, 'pack.json'), JSON.stringify([pack]));
  return { directory, pack };
}

void test('actual tarball integrity and bundle bytes must match before publication', () => {
  const { directory, pack } = artifacts();
  try {
    assert.deepEqual(verifyArtifacts(directory, pack), pack);
    writeFileSync(path.join(directory, 'naka.min.js'), 'changed');
    assert.throws(() => verifyArtifacts(directory, pack), /differs from tarball/);
    writeFileSync(path.join(directory, pack.filename), 'changed');
    assert.throws(() => verifyArtifacts(directory, pack), /integrity differs/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

void test('partial publication recovery reuses matching assets, adds missing ones, and preserves release notes', async () => {
  const { directory, pack } = artifacts();
  const uploaded = [];
  let published = 0;
  const release = { ...draft, body: 'Release Please notes', assets: [{ name: 'naka.js', id: 1 }] };
  const api = {
    resolve: async () => sha,
    releases: async () => [release],
    download: async () => readFileSync(path.join(directory, 'naka.js')),
    upload: async (tag, path) => {
      uploaded.push(path);
    },
    publish: async () => {
      published++;
    },
  };
  try {
    await finalizeRelease(api, 'v0.2.0', sha, directory, pack);
    assert.equal(uploaded.length, 2);
    assert.equal(published, 1);
    assert.equal(release.body, 'Release Please notes');
    release.assets = ['naka.js', 'naka.min.js', pack.filename].map((name, id) => ({ name, id }));
    api.download = async (id) => readFileSync(path.join(directory, release.assets[id].name));
    release.draft = false;
    await finalizeRelease(api, 'v0.2.0', sha, directory, pack);
    assert.equal(uploaded.length, 2);
    assert.equal(published, 1);
    api.download = async () => Buffer.from('conflict');
    release.assets = [{ name: pack.filename, id: 0 }];
    await assert.rejects(
      finalizeRelease(api, 'v0.2.0', sha, directory, pack),
      /refusing overwrite/,
    );
    assert.equal(uploaded.length, 2);
    await assert.rejects(finalizeRelease(api, 'v0.2.0', oldSha, directory, pack), /expected SHA/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

void test('failed asset upload leaves the draft unpublished for recovery', async () => {
  const { directory, pack } = artifacts();
  let published = false;
  const api = {
    resolve: async () => sha,
    releases: async () => [draft],
    upload: async () => {
      throw new Error('upload failed');
    },
    publish: async () => {
      published = true;
    },
  };
  try {
    await assert.rejects(finalizeRelease(api, 'v0.2.0', sha, directory, pack), /upload failed/);
    assert.equal(published, false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

void test('manual tagged bootstrap creates a draft, attaches assets, then publishes', async () => {
  const { directory, pack } = artifacts();
  const calls = [];
  let releases = [];
  const api = {
    resolve: async () => sha,
    releases: async () => releases,
    create: async (tag, target) => {
      calls.push(['create', tag, target]);
      releases = [draft];
    },
    upload: async (tag, path) => calls.push(['upload', tag, path]),
    publish: async (tag) => calls.push(['publish', tag]),
  };
  try {
    await finalizeRelease(api, 'v0.2.0', sha, directory, pack);
    assert.deepEqual(calls[0], ['create', 'v0.2.0', sha]);
    assert.equal(calls.filter((call) => call[0] === 'upload').length, 3);
    assert.deepEqual(calls.at(-1), ['publish', 'v0.2.0']);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
