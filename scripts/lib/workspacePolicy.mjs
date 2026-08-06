/**
 * The workspace's package topology in one place.
 *
 * A package entry states both what the package is and the complete runtime-facing
 * manifest surface it is allowed to carry. Architecture checks, project-reference
 * checks, and the pack test all consume these facts instead of maintaining parallel
 * lists that can drift independently.
 */

const ROOT_EXPORTS = ['.', './package.json'];

function definePackage(policy) {
  return Object.freeze({
    optionalDependencies: [],
    peerDependencies: [],
    exportKeys: undefined,
    ...policy,
  });
}

export const WORKSPACE_PACKAGE_POLICIES = Object.freeze([
  definePackage({
    name: '@kajay/core',
    directory: 'packages/core',
    role: 'core',
    published: true,
    dependencies: [],
    exportKeys: ROOT_EXPORTS,
  }),
  definePackage({
    name: '@kajay/react',
    directory: 'packages/react',
    role: 'ui',
    published: true,
    dependencies: ['@kajay/core'],
    peerDependencies: ['react'],
    exportKeys: ROOT_EXPORTS,
  }),
  definePackage({
    name: '@kajay/creator-core',
    directory: 'packages/creator-core',
    role: 'core',
    published: true,
    dependencies: ['@kajay/core'],
    exportKeys: ROOT_EXPORTS,
  }),
  definePackage({
    name: '@kajay/creator-react',
    directory: 'packages/creator-react',
    role: 'ui',
    published: true,
    dependencies: ['@kajay/core', '@kajay/creator-core', '@kajay/react'],
    peerDependencies: ['react'],
    exportKeys: ROOT_EXPORTS,
  }),
  definePackage({
    name: '@kajay/themes',
    directory: 'packages/themes',
    role: 'assets',
    published: true,
    dependencies: [],
    exportKeys: ['.', './package.json', './styles.css', './themes/*.css'],
  }),
  definePackage({
    name: '@kajay/host-demo',
    directory: 'apps/host-demo',
    role: 'application',
    published: false,
    dependencies: [
      '@kajay/core',
      '@kajay/react',
      '@kajay/creator-core',
      '@kajay/creator-react',
      '@kajay/themes',
      'react',
      'react-dom',
    ],
  }),
  definePackage({
    name: '@kajay/sdk-demo',
    directory: 'apps/sdk-demo',
    role: 'application',
    published: false,
    dependencies: [
      '@kajay/core',
      '@kajay/creator-react',
      '@kajay/react',
      '@kajay/themes',
      'react',
      'react-dom',
    ],
  }),
  definePackage({
    name: '@kajay/site',
    directory: 'apps/site',
    role: 'application',
    published: false,
    // An application's list is long because an application's list *is* long — this one
    // brings a router, a CSS engine and the Radix primitives its design system is built
    // from. Enumerating it is the cost of the exact-match rule, and it is worth paying
    // here for the same reason it is worth paying for a package: the moment a dependency
    // arrives without anybody deciding to add it, this file says so.
    dependencies: [
      '@kajay/core',
      '@kajay/creator-core',
      '@kajay/creator-react',
      '@kajay/react',
      '@kajay/themes',
      // The public documentation endpoint speaks MCP through the official Web Standard
      // transport. It remains an application concern and never enters a published package.
      '@modelcontextprotocol/sdk',
      '@tanstack/react-router',
      '@tanstack/react-start',
      'class-variance-authority',
      'clsx',
      'lucide-react',
      // One package, not one per primitive: shadcn's generated components import from
      // the unified `radix-ui` re-export, so adding a component adds no dependency. That
      // is what keeps this list from growing every time the site gains a control.
      'radix-ui',
      'react',
      'react-dom',
      'tailwind-merge',
      // MCP tool inputs are untrusted protocol data and are validated at the feature seam.
      'zod',
    ],
  }),
]);

export const PUBLISHED_PACKAGE_POLICIES = Object.freeze(
  WORKSPACE_PACKAGE_POLICIES.filter(({ published }) => published),
);

export const ROOT_PROJECT_REFERENCES = Object.freeze([
  ...WORKSPACE_PACKAGE_POLICIES.map(({ directory }) => directory),
  'tsconfig.tests.json',
]);

export const REQUIRED_CI_JOBS = Object.freeze([
  {
    name: 'architecture',
    commands: ['pnpm run check:arch', 'pnpm run check:test-policy', 'pnpm run check:parity'],
  },
  { name: 'pack', commands: ['pnpm run test:pack'] },
]);

export function workspacePackagePolicy(name) {
  return WORKSPACE_PACKAGE_POLICIES.find((policy) => policy.name === name);
}

export function isCorePackage(name) {
  return workspacePackagePolicy(name)?.role === 'core';
}

export function isUiPackage(name) {
  return workspacePackagePolicy(name)?.role === 'ui';
}
