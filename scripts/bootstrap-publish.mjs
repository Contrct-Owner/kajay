#!/usr/bin/env node
/**
 * The one-time bootstrap publish, so trusted publishing can be configured at all.
 *
 * **Why this exists.** npm will not let you register a trusted publisher for a package
 * that does not exist, and the workflow cannot create one because it has no identity until
 * a publisher is registered. This breaks that circle exactly once: it puts a *prerelease*
 * on the registry under its own dist-tag, which is enough for npm to know the package
 * names, and nothing else.
 *
 * **It deliberately does not publish `1.0.0`.** A prerelease is never served as `latest`,
 * so the version people install stays unpublished until the workflow does it properly —
 * from a verified commit, with provenance. Publishing 1.0.0 from a laptop would work and
 * would leave the flagship version permanently unattested, which is the opposite of what
 * ADR-0029 chose provenance for.
 *
 * Run it once, register the five publishers on npmjs.com, then never run it again. The
 * ordinary path is `.github/workflows/release.yml`.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

/**
 * Dependency order, so the registry never holds a half-graph.
 *
 * npm does not verify that a dependency exists at publish time, so nothing *enforces*
 * this — but somebody installing between two of these calls should not get a package
 * whose dependency is a 404.
 */
const PACKAGES = ['core', 'themes', 'react', 'creator-core', 'creator-react'];

/** Its own dist-tag, so `npm install @kajay/core` cannot resolve to it. */
const TAG = 'bootstrap';

const manifestPath = (name) => resolve(ROOT, 'packages', name, 'package.json');
const readManifest = (name) => readFileSync(manifestPath(name), 'utf8');

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: 'pipe', ...options });
}

/**
 * Points every `@kajay/*` dependency at the prerelease.
 *
 * Without this, `pnpm publish` rewrites `workspace:*` to the *released* version — which
 * is not on the registry yet, so the published prerelease would declare a dependency that
 * cannot be resolved.
 */
function pinInternalDependencies(manifest, version) {
  for (const field of ['dependencies', 'peerDependencies']) {
    const dependencies = manifest[field];
    if (dependencies === undefined) {
      continue;
    }
    for (const name of Object.keys(dependencies).filter((key) => key.startsWith('@kajay/'))) {
      dependencies[name] = version;
    }
  }
}

function fail(message) {
  process.stderr.write(`\n✗ ${message}\n`);
  process.exit(1);
}

// --- Refuse to start unless everything is as expected -----------------------

// A dirty tree means the tarball corresponds to no commit. That matters more here than
// usual: this publish is not reproducible from the workflow, so the only record of what
// went out is the commit it went out from.
if (run('git', ['status', '--porcelain'], { cwd: ROOT }).trim() !== '') {
  fail('The working tree is dirty. Commit or stash first — a publish should name a commit.');
}

let account;
try {
  account = run('npm', ['whoami']).trim();
} catch {
  fail('Not logged in to npm. Run `npm login`, then try again.');
}

const original = new Map(PACKAGES.map((name) => [name, readManifest(name)]));
const versions = new Set(
  PACKAGES.map((name) => JSON.parse(original.get(name)).version),
);
if (versions.size !== 1) {
  fail(`The five packages disagree on their version: ${[...versions].join(', ')}.`);
}
const [released] = [...versions];
const bootstrap = `${released}-${TAG}.0`;

const commit = run('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).trim();

process.stdout.write(
  `\nBootstrap publish\n` +
    `  npm account   ${account}\n` +
    `  commit        ${commit}\n` +
    `  publishing    ${bootstrap}  (dist-tag: ${TAG})\n` +
    `  NOT touching  ${released}   — the workflow publishes that, with provenance\n` +
    `  packages      ${PACKAGES.map((name) => `@kajay/${name}`).join(', ')}\n\n`,
);

const rl = createInterface({ input: process.stdin, output: process.stdout });
const confirm = await rl.question('Type BOOTSTRAP to publish, anything else to stop: ');
if (confirm !== 'BOOTSTRAP') {
  rl.close();
  fail('Not confirmed. Nothing published.');
}

/**
 * **A fresh code per package, asked for immediately before it is used.**
 *
 * An npm one-time password lasts about thirty seconds and five publishes take longer than
 * that, so a single code collected up front expires somewhere in the middle — publishing
 * two packages and failing on the third, which is the worst outcome available: a partial
 * release, with no way to retry the whole thing because the first names now exist.
 *
 * Blank means 2FA is off, or that a granular token with 2FA bypass is in use; in both
 * cases `--otp` is simply omitted.
 */
async function otpFor(name) {
  const code = (await rl.question(`  npm OTP for @kajay/${name} (blank if 2FA is off): `)).trim();
  return code === '' ? [] : ['--otp', code];
}

// --- Restore no matter how this ends ----------------------------------------

/**
 * **The brake goes back on even if this crashes.**
 *
 * `publishConfig.provenance` is what stops anyone publishing from a laptop, and this
 * script has to defeat it for the length of one command. Leaving it off would quietly
 * remove a guard that ADR-0029 put there on purpose, and nobody would notice until the
 * next accidental `npm publish` succeeded.
 */
let restored = false;
function restore() {
  if (restored) {
    return;
  }
  restored = true;
  for (const name of PACKAGES) {
    writeFileSync(manifestPath(name), original.get(name));
  }
  process.stdout.write('\n  manifests restored (version and provenance)\n');
}
process.on('exit', restore);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    restore();
    process.exit(130);
  });
}

// --- Publish -----------------------------------------------------------------

const published = [];
try {
  for (const name of PACKAGES) {
    const manifest = JSON.parse(original.get(name));
    manifest.version = bootstrap;
    pinInternalDependencies(manifest, bootstrap);
    delete manifest.publishConfig.provenance;
    writeFileSync(manifestPath(name), `${JSON.stringify(manifest, undefined, 2)}\n`);

    // Sequential on purpose, so the rule's `Promise.all` advice is the one thing that must
    // not happen here: these publish in dependency order, and each code has to be minted
    // seconds before the request it authenticates. Collecting five up front is precisely
    // the bug this loop shape exists to avoid.
    // eslint-disable-next-line no-await-in-loop
    const otp = await otpFor(name);
    process.stdout.write(`  publishing @kajay/${name} …`);
    // **`pnpm`, never `npm`.** Rewriting `workspace:*` into a real version is a pnpm
    // feature; `npm publish` would push the literal specifier and produce a package
    // nobody can install — which the rollback policy says we would never unpublish.
    run(
      'pnpm',
      [
        'publish',
        '--tag',
        TAG,
        '--access',
        'public',
        // The tree is clean — checked above — but the manifests are edited right now,
        // which pnpm's own check would refuse.
        '--no-git-checks',
        ...otp,
      ],
      { cwd: resolve(ROOT, 'packages', name), stdio: 'inherit' },
    );
    published.push(`@kajay/${name}`);
    process.stdout.write(' done\n');
  }
} catch (error) {
  rl.close();
  restore();
  process.stderr.write(`\n${String(error.stderr ?? error.message ?? error)}\n`);
  fail(
    published.length === 0
      ? 'Nothing was published.'
      : `Published ${published.join(', ')} before failing. Those names now exist, which is ` +
          'enough to register their publishers; the rest still need this script re-run.',
  );
}

rl.close();
restore();

process.stdout.write(
  `\n✓ ${published.length} packages published at ${bootstrap} under the "${TAG}" tag.\n\n` +
    'Next, on npmjs.com, for each of the five packages:\n' +
    '  Settings → Trusted publisher → GitHub Actions\n' +
    '    repository   Contrct-Owner/kajay\n' +
    '    workflow     release.yml\n' +
    '    environment  release\n\n' +
    'Then release properly — from a verified commit, with provenance:\n' +
    `  gh workflow run release.yml -f version=${released} -f confirm=RELEASE\n\n` +
    'Afterwards the prerelease can be tidied away:\n' +
    PACKAGES.map(
      (name) => `  npm deprecate @kajay/${name}@${bootstrap} "Bootstrap only; use ${released}"`,
    ).join('\n') +
    '\n',
);
