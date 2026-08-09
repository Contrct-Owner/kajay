import { spawnSync } from 'node:child_process';

/**
 * Whether this branch says what it does to the published packages — ADR-0029.
 *
 * A changeset is how a change becomes a version, so a pull request without one is a change
 * that ships silently: the packages move to a new number with nothing in the changelog
 * saying why, and `changeset version` never bumps them at all. Both are the kind of mistake
 * nobody notices until somebody upgrades.
 *
 * **It asks Changesets rather than looking for files**, which is the difference between a
 * check and a formality. `changeset status` compares the *packages a branch touched* against
 * the changesets it carries, so a pull request that edits only documentation, CI, or the
 * reference application passes without one — there is nothing to release — and one that
 * edits `packages/core` does not.
 *
 * **An empty changeset is the escape hatch and is meant to be used.** A refactor with no
 * observable behaviour is a real thing; `changeset add --empty` records the judgement that
 * this is one, which is a sentence in a review rather than a silence.
 */
const base = process.env['CHANGESET_BASE'] ?? 'origin/main';
const head = process.env['CHANGESET_HEAD'] ?? '';

/**
 * The branch `changesets/action` writes the version bump to.
 *
 * **The one pull request that legitimately changes every package and carries no changeset**,
 * because consuming them is what it is *for*: it bumps five manifests, writes five
 * changelogs and deletes the files that asked for it. `changeset status` compares changed
 * packages against available changesets and cannot tell that apart from an undeclared
 * change — nor should it, since from where it stands the two are identical.
 *
 * Without this the check blocks the release it exists to protect: the version pull request
 * could never go green, so `main` could never reach a version, so nothing could ever be
 * published. Recorded at this length because the failure is silent until the first release
 * and looks like the automation being broken rather than the guard being too strict.
 */
const VERSION_BRANCH = 'changeset-release/';

if (head.startsWith(VERSION_BRANCH)) {
  console.log(`${head} is the version pull request; consuming changesets is what it is for.`);
  process.exit(0);
}

/**
 * Only a pull request has something to compare against.
 *
 * On `main` the comparison is the branch with itself, and running it there would report
 * every package as unreleased for as long as changesets are waiting — which is the normal
 * state of `main` between a merge and a version pull request. The job still *runs* on every
 * event and reports success, because the aggregate check treats a skipped job as a failed
 * one and a green `main` should not depend on remembering that.
 */
if (process.env['GITHUB_EVENT_NAME'] !== undefined && process.env['GITHUB_EVENT_NAME'] !== 'pull_request') {
  console.log(`Not a pull request (${process.env['GITHUB_EVENT_NAME']}); nothing to compare against.`);
  process.exit(0);
}

const result = spawnSync(
  process.execPath,
  ['node_modules/@changesets/cli/bin.js', 'status', `--since=${base}`],
  { encoding: 'utf8' },
);
process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');

if (result.status !== 0) {
  console.error(
    [
      '',
      `No changeset covers the packages this branch changed (compared against ${base}).`,
      '',
      "  pnpm changeset            declare what changed and how it moves the version",
      "  pnpm changeset -- --empty  record that this one needs no release",
      '',
      'A single version train (ADR-0005) means all five packages move together, so the',
      'largest bump any changeset asks for is the one they all take.',
    ].join('\n'),
  );
  process.exit(1);
}

console.log(`Every changed package is covered by a changeset (compared against ${base}).`);
