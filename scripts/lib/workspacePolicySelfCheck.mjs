import { importSpecifiers } from './workspace.mjs';
import {
  PUBLISHED_PACKAGE_POLICIES,
  ROOT_PROJECT_REFERENCES,
  WORKSPACE_PACKAGE_POLICIES,
  workspacePackagePolicy,
} from './workspacePolicy.mjs';
import { workspacePolicyViolations } from './workspacePolicyRules.mjs';

function fixturePackage(policy) {
  const exportsMap = policy.exportKeys === undefined
    ? undefined
    : Object.fromEntries(policy.exportKeys.map((key) => [key, './fixture.js']));
  const projectReferences = policy.dependencies
    .map((name) => workspacePackagePolicy(name)?.directory)
    .filter((directory) => directory !== undefined);
  return {
    name: policy.name,
    relativeDir: policy.directory,
    manifest: {
      name: policy.name,
      dependencies: Object.fromEntries(policy.dependencies.map((name) => [name, 'fixture'])),
      optionalDependencies: Object.fromEntries(policy.optionalDependencies.map((name) => [name, 'fixture'])),
      peerDependencies: Object.fromEntries(policy.peerDependencies.map((name) => [name, 'fixture'])),
      ...(exportsMap === undefined ? {} : { exports: exportsMap }),
    },
    projectReferences,
    tsconfigPresent: true,
  };
}

function cleanSnapshot() {
  return {
    packages: WORKSPACE_PACKAGE_POLICIES.map((policy) => fixturePackage(policy)),
    rootProjectReferences: [...ROOT_PROJECT_REFERENCES],
    packTargets: PUBLISHED_PACKAGE_POLICIES.map(({ name }) => name),
    ciWorkflow: `jobs:
  architecture:
    steps:
      - run: pnpm run check:arch
      - run: pnpm run check:test-policy
      - run: pnpm run check:parity
  pack:
    steps:
      - run: pnpm run test:pack
  survey-checks:
    needs: [architecture, pack]
`,
    scriptSources: [{ location: 'scripts/clean.mjs', source: "import './lib/clean.mjs';" }],
  };
}

function packageFixture(snapshot, name) {
  const found = snapshot.packages.find((entry) => entry.name === name);
  if (found === undefined) {
    throw new Error(`Self-check fixture package "${name}" is missing.`);
  }
  return found;
}

const MUTATIONS = [
  {
    name: 'root script reaches into package implementation',
    rule: 'repository-script-package-boundary',
    apply(snapshot) {
      const privatePath = ['packages', 'core', 'dist', 'private.js'].join('/');
      snapshot.scriptSources[0].source = `resolve(repoRoot, '${privatePath}')`;
    },
  },
  {
    name: 'missing exports',
    rule: 'published-exports',
    apply(snapshot) {
      delete packageFixture(snapshot, '@kajay/core').manifest.exports;
    },
  },
  {
    name: 'illegal optional dependency',
    rule: 'dependency-policy',
    apply(snapshot) {
      packageFixture(snapshot, '@kajay/core').manifest.optionalDependencies['left-pad'] = 'fixture';
    },
  },
  {
    name: 'illegal peer dependency',
    rule: 'dependency-policy',
    apply(snapshot) {
      packageFixture(snapshot, '@kajay/react').manifest.peerDependencies['react-dom'] = 'fixture';
    },
  },
  {
    name: 'missing React peer',
    rule: 'react-peer-required',
    apply(snapshot) {
      delete packageFixture(snapshot, '@kajay/react').manifest.peerDependencies.react;
    },
  },
  {
    name: 'stale project reference',
    rule: 'project-references',
    apply(snapshot) {
      packageFixture(snapshot, '@kajay/core').projectReferences.push('packages/themes');
    },
  },
  {
    name: 'stale pack target',
    rule: 'pack-targets',
    apply(snapshot) {
      snapshot.packTargets.pop();
    },
  },
  {
    name: 'unknown workspace package',
    rule: 'workspace-package-set',
    apply(snapshot) {
      snapshot.packages.push({
        name: '@kajay/unknown',
        relativeDir: 'packages/unknown',
        manifest: { name: '@kajay/unknown' },
        projectReferences: [],
      });
    },
  },
  {
    name: 'missing workspace package',
    rule: 'workspace-package-set',
    apply(snapshot) {
      snapshot.packages.pop();
    },
  },
  {
    name: 'missing CI policy command',
    rule: 'ci-policy-gates',
    apply(snapshot) {
      snapshot.ciWorkflow = snapshot.ciWorkflow.replace('pnpm run check:parity', 'pnpm run lint');
    },
  },
];

function assertMutationProofs() {
  const clean = workspacePolicyViolations(cleanSnapshot());
  if (clean.length > 0) {
    throw new Error(`Workspace-policy self-check fixture is invalid: ${clean[0].detail}`);
  }
  for (const mutation of MUTATIONS) {
    const snapshot = structuredClone(cleanSnapshot());
    mutation.apply(snapshot);
    const violations = workspacePolicyViolations(snapshot);
    if (!violations.some(({ rule }) => rule === mutation.rule)) {
      throw new Error(`Workspace policy did not reject the ${mutation.name} mutation.`);
    }
  }
}

function assertImportDiscovery() {
  const source = `
    import type { A } from '@fixture/import-type';
    export { b } from '@fixture/re-export';
    export type * from '@fixture/type-re-export';
    const lazy = import('@fixture/dynamic');
    type Shape = import('@fixture/import-query').Shape;
    import legacy = require('@fixture/import-equals');
    const resolved = require.resolve('@fixture/require-resolve');
    const metaResolved = import.meta.resolve('@fixture/meta-resolve');
    const prose = "import('@fixture/not-code')";
  `;
  const found = importSpecifiers(source).toSorted();
  const expected = [
    '@fixture/dynamic',
    '@fixture/import-equals',
    '@fixture/import-query',
    '@fixture/import-type',
    '@fixture/meta-resolve',
    '@fixture/re-export',
    '@fixture/require-resolve',
    '@fixture/type-re-export',
  ];
  if (JSON.stringify(found) !== JSON.stringify(expected)) {
    throw new Error(`TypeScript import discovery self-check failed: ${JSON.stringify(found)}`);
  }
}

/** Proves every high-risk workspace rule against a known mutation on every arch run. */
export function assertWorkspacePolicyRulesWork() {
  assertMutationProofs();
  assertImportDiscovery();
}
