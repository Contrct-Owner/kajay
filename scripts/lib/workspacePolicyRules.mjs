import {
  PUBLISHED_PACKAGE_POLICIES,
  REQUIRED_CI_JOBS,
  ROOT_PROJECT_REFERENCES,
  WORKSPACE_PACKAGE_POLICIES,
  isCorePackage,
  isUiPackage,
  workspacePackagePolicy,
} from './workspacePolicy.mjs';
import { stringLiterals } from './workspace.mjs';

function missingFrom(actual, expected) {
  const found = new Set(actual);
  return expected.filter((item) => !found.has(item));
}

function reportExactSet(rule, location, label, actual, expected, fail) {
  for (const item of missingFrom(actual, expected)) {
    fail(rule, location, `${label} is missing required entry "${item}".`);
  }
  for (const item of missingFrom(expected, actual)) {
    fail(rule, location, `${label} contains forbidden entry "${item}".`);
  }
}

function checkPackageSet(packages, fail) {
  const byName = new Map();
  for (const entry of packages) {
    if (byName.has(entry.name)) {
      fail('workspace-package-set', entry.relativeDir, `Duplicate workspace package name "${entry.name}".`);
    } else {
      byName.set(entry.name, entry);
    }
    const policy = workspacePackagePolicy(entry.name);
    if (policy === undefined) {
      fail('workspace-package-set', entry.relativeDir, `Unknown workspace package "${entry.name}".`);
    } else if (policy.directory !== entry.relativeDir) {
      fail(
        'workspace-package-set',
        entry.relativeDir,
        `Package "${entry.name}" must live at "${policy.directory}", not "${entry.relativeDir}".`,
      );
    }
  }
  for (const policy of WORKSPACE_PACKAGE_POLICIES) {
    if (!byName.has(policy.name)) {
      fail('workspace-package-set', policy.directory, `Required workspace package "${policy.name}" is missing.`);
    }
  }
}

function dependencyNames(manifest, field) {
  const value = manifest[field];
  return value !== undefined && typeof value === 'object' && !Array.isArray(value)
    ? Object.keys(value)
    : [];
}

function checkDependencySections(entry, policy, fail) {
  const fields = ['dependencies', 'optionalDependencies', 'peerDependencies'];
  for (const field of fields) {
    const declaration = entry.manifest[field];
    if (declaration !== undefined && (declaration === null || typeof declaration !== 'object' || Array.isArray(declaration))) {
      fail('dependency-policy', `${entry.relativeDir}/package.json`, `${policy.name} ${field} must be an object.`);
    }
    reportExactSet(
      'dependency-policy',
      `${entry.relativeDir}/package.json`,
      `${policy.name} ${field}`,
      dependencyNames(entry.manifest, field),
      policy[field],
      fail,
    );
  }
  const runtimeReact = [
    ...dependencyNames(entry.manifest, 'dependencies'),
    ...dependencyNames(entry.manifest, 'optionalDependencies'),
  ].includes('react');
  if (isUiPackage(policy.name) && runtimeReact) {
    fail('react-peer-only', entry.relativeDir, `UI package "${policy.name}" must take React only as a peer.`);
  }
  if (isUiPackage(policy.name) && !dependencyNames(entry.manifest, 'peerDependencies').includes('react')) {
    fail('react-peer-required', entry.relativeDir, `UI package "${policy.name}" must declare React as a peer.`);
  }
  if (isCorePackage(policy.name)) {
    const thirdParty = dependencyNames(entry.manifest, 'dependencies')
      .filter((name) => !name.startsWith('@kajay/'));
    for (const name of thirdParty) {
      fail('core-zero-dependencies', entry.relativeDir, `Core package "${policy.name}" has runtime dependency "${name}".`);
    }
  }
}

function checkPublishedExports(entry, policy, fail) {
  if (!policy.published) {
    return;
  }
  const exportsMap = entry.manifest.exports;
  if (exportsMap === undefined || exportsMap === null || typeof exportsMap !== 'object' || Array.isArray(exportsMap)) {
    fail('published-exports', `${entry.relativeDir}/package.json`, `Published package "${policy.name}" needs an exports map.`);
    return;
  }
  reportExactSet(
    'published-exports',
    `${entry.relativeDir}/package.json`,
    `${policy.name} exports`,
    Object.keys(exportsMap),
    policy.exportKeys,
    fail,
  );
}

function expectedProjectReferences(policy) {
  return policy.dependencies
    .map((name) => workspacePackagePolicy(name)?.directory)
    .filter((directory) => directory !== undefined)
    .toSorted();
}

function checkPackage(entry, fail) {
  const policy = workspacePackagePolicy(entry.name);
  if (policy === undefined) {
    return;
  }
  checkDependencySections(entry, policy, fail);
  checkPublishedExports(entry, policy, fail);
  if (entry.tsconfigPresent === false) {
    fail('project-references', `${entry.relativeDir}/tsconfig.json`, `${policy.name} must declare a TypeScript project.`);
    return;
  }
  reportExactSet(
    'project-references',
    `${entry.relativeDir}/tsconfig.json`,
    `${policy.name} project references`,
    entry.projectReferences,
    expectedProjectReferences(policy),
    fail,
  );
}

function workflowJobBlock(source, name) {
  const lines = source.split('\n');
  const start = lines.findIndex((line) => line === `  ${name}:`);
  if (start < 0) {
    return;
  }
  const end = lines.findIndex((line, index) => index > start && /^  [\w-]+:\s*$/u.test(line));
  return lines.slice(start, end < 0 ? undefined : end).join('\n');
}

function checkCiWorkflow(source, fail) {
  for (const job of REQUIRED_CI_JOBS) {
    const block = workflowJobBlock(source, job.name);
    if (block === undefined) {
      fail('ci-policy-gates', '.github/workflows/ci.yml', `Required CI job "${job.name}" is missing.`);
      continue;
    }
    for (const command of job.commands) {
      if (!block.includes(command)) {
        fail('ci-policy-gates', '.github/workflows/ci.yml', `CI job "${job.name}" must run "${command}".`);
      }
    }
  }
  const gate = workflowJobBlock(source, 'survey-checks');
  for (const job of REQUIRED_CI_JOBS) {
    const needs = /^    needs:\s*\[([^\]]*)\]/mu.exec(gate ?? '')?.[1]
      .split(',')
      .map((name) => name.trim()) ?? [];
    if (!needs.includes(job.name)) {
      fail('ci-policy-gates', '.github/workflows/ci.yml', `survey-checks must require CI job "${job.name}".`);
    }
  }
}

function checkRepositoryScriptBoundaries(scriptSources, fail) {
  for (const { location, source } of scriptSources) {
    for (const value of stringLiterals(source)) {
      const normalized = value.replaceAll('\\', '/');
      const sourcePath = /(?:^|\/)packages\/[^/]+\/src(?:\/|$)/u.test(normalized);
      const distPath = /(?:^|\/)packages\/[^/]+\/dist\/(?!index\.js$)/u.test(normalized);
      if (sourcePath || distPath) {
        fail(
          'repository-script-package-boundary',
          location,
          `References private package implementation path "${value}". Invoke a package-owned script or consume its published root.`,
        );
      }
    }
  }
}

export function workspacePolicyViolations(snapshot) {
  const violations = [];
  const fail = (rule, location, detail) => violations.push({ rule, location, detail });
  checkPackageSet(snapshot.packages, fail);
  for (const entry of snapshot.packages) {
    checkPackage(entry, fail);
  }
  reportExactSet(
    'root-project-references',
    'tsconfig.json',
    'Root project references',
    snapshot.rootProjectReferences,
    ROOT_PROJECT_REFERENCES,
    fail,
  );
  if (snapshot.packTargets !== undefined) {
    reportExactSet(
      'pack-targets',
      'scripts/pack-test.mjs',
      'Pack targets',
      snapshot.packTargets,
      PUBLISHED_PACKAGE_POLICIES.map(({ name }) => name),
      fail,
    );
  }
  if (snapshot.ciWorkflow !== undefined) {
    checkCiWorkflow(snapshot.ciWorkflow, fail);
  }
  if (snapshot.scriptSources !== undefined) {
    checkRepositoryScriptBoundaries(snapshot.scriptSources, fail);
  }
  return violations;
}
