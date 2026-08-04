#!/usr/bin/env node
/**
 * The pack test: build tarballs, install them into a scratch project **outside** the
 * workspace, compile that project under every supported TypeScript version, and run a
 * smoke scenario.
 *
 * This is the check that catches what workspace symlinks hide — a broken `exports`
 * map, a `files` field that forgets the stylesheets, a missing declaration emit, or an
 * accidental reliance on the monorepo layout. It stands in for a real third-party
 * consumer.
 *
 * The TypeScript matrix is the consumer-facing compatibility contract (ADR-0014).
 * Each version is installed **into the scratch project**, not borrowed from this
 * repo's node_modules, because that is what a consumer actually has.
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CREATOR_TSX, SMOKE_TS } from './pack-fixtures.mjs';
import { PUBLIC_RUNTIME_SURFACE } from './lib/publicRuntimeSurface.mjs';
import { PUBLISHED_PACKAGE_POLICIES } from './lib/workspacePolicy.mjs';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

/**
 * Supported consumer TypeScript versions, oldest first (ADR-0014).
 *
 * The default is deliberately the three that carry meaning: the declared **floor**,
 * the **6.x line** (many consumers are still there), and the **current** release.
 * Dropping the floor is a breaking change for consumers.
 *
 * CI runs the full sweep on a schedule via KAJAY_TS_MATRIX; use the same variable for
 * a one-off probe: KAJAY_TS_MATRIX="5.5,5.6,5.7,5.8,5.9,~6.0.3,^7.0.2".
 */
const SUPPORTED_TYPESCRIPT = (process.env['KAJAY_TS_MATRIX'] ?? '5.5,~6.0.3,^7.0.2')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

function run(command, args, cwd) {
  return execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function describeError(error) {
  const parts = [error.stdout, error.stderr].filter(Boolean).map(String).join('');
  return parts.trim() || error.message;
}

const CSS_RESOLVER = `const specifiers = JSON.parse(process.argv[2] ?? '[]');
const resolved = specifiers.map((specifier) => ({ specifier, url: import.meta.resolve(specifier) }));
process.stdout.write(JSON.stringify(resolved));
`;

function resolveCssSubpaths(scratch, specifiers) {
  const resolver = join(scratch, 'resolve-css-subpaths.mjs');
  writeFileSync(resolver, CSS_RESOLVER, 'utf8');
  return JSON.parse(run('node', [basename(resolver), JSON.stringify(specifiers)], scratch));
}

function publishedCssSubpaths(scratch) {
  const themeDir = join(scratch, 'node_modules', '@kajay', 'themes', 'styles', 'themes');
  const presets = readdirSync(themeDir)
    .filter((file) => file.endsWith('.css'))
    .toSorted()
    .map((file) => ({
      specifier: `@kajay/themes/themes/${file}`,
      expected: join(themeDir, file),
    }));
  return [
    {
      specifier: '@kajay/themes/styles.css',
      expected: join(scratch, 'node_modules', '@kajay', 'themes', 'styles', 'styles.css'),
    },
    ...presets,
  ];
}

function verifyPublishedCss(scratch) {
  const published = publishedCssSubpaths(scratch);
  const resolutions = resolveCssSubpaths(
    scratch,
    published.map(({ specifier }) => specifier),
  );
  const themeRoot = realpathSync(resolve(scratch, 'node_modules', '@kajay', 'themes'));
  const contents = new Map();

  for (const item of published) {
    const resolution = resolutions.find(({ specifier }) => specifier === item.specifier);
    const resolvedPath = resolution === undefined ? '' : resolve(fileURLToPath(resolution.url));
    if (resolvedPath.length === 0 || !existsSync(resolvedPath)) {
      throw new Error(`${item.specifier} resolved to ${resolvedPath || '(nothing)'}, which is not a file.`);
    }
    const installedPath = realpathSync(resolvedPath);
    const fromPackage = relative(themeRoot, installedPath);
    if (fromPackage.startsWith('..') || isAbsolute(fromPackage)) {
      throw new Error(`${item.specifier} did not resolve inside the installed @kajay/themes tarball.`);
    }
    const expectedPath = realpathSync(resolve(item.expected));
    if (installedPath !== expectedPath) {
      throw new Error(`${item.specifier} resolved to ${installedPath}, expected ${expectedPath}.`);
    }
    const content = readFileSync(installedPath, 'utf8');
    if (!content.includes('--kajay-')) {
      throw new Error(`Packed stylesheet ${item.specifier} does not contain Kajay tokens.`);
    }
    contents.set(item.specifier, content);
    console.log(`  stylesheet resolves: ${item.specifier}`);
  }
  return contents;
}

function proveBrokenCssExportFails(scratch) {
  const manifestPath = join(scratch, 'node_modules', '@kajay', 'themes', 'package.json');
  const original = readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(original);
  const brokenExports = { ...manifest.exports };
  delete brokenExports['./styles.css'];
  writeFileSync(manifestPath, `${JSON.stringify({ ...manifest, exports: brokenExports }, null, 2)}\n`, 'utf8');
  try {
    try {
      resolveCssSubpaths(scratch, ['@kajay/themes/styles.css']);
    } catch (error) {
      const detail = describeError(error);
      if (detail.includes('ERR_PACKAGE_PATH_NOT_EXPORTED')) {
        console.log('  broken stylesheet export is rejected');
        return;
      }
      throw new Error(`The broken stylesheet export failed for the wrong reason: ${detail}`, {
        cause: error,
      });
    }
    throw new Error('A package with a missing ./styles.css export still resolved that subpath.');
  } finally {
    writeFileSync(manifestPath, original, 'utf8');
  }
}

function verifyInstalledRuntimeSurface(scratch) {
  const probe = `const expected = ${JSON.stringify(PUBLIC_RUNTIME_SURFACE)};
for (const [packageName, expectedValues] of Object.entries(expected)) {
  const actual = Object.keys(await import(packageName)).toSorted();
  const wanted = [...expectedValues].toSorted();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(packageName + ' runtime surface\\nexpected: ' + wanted.join(', ') + '\\nactual: ' + actual.join(', '));
  }
  console.log('  runtime surface: ' + packageName + ' (' + actual.length + ' values)');
}`;
  const path = join(scratch, 'check-runtime-surface.mjs');
  writeFileSync(path, probe, 'utf8');
  process.stdout.write(run('node', [basename(path)], scratch));
}

const scratch = mkdtempSync(join(tmpdir(), 'kajay-pack-'));
const failures = [];

try {
  console.log(`Scratch project: ${scratch}`);

  // Packed with pnpm because the workspace uses it: `workspace:*` and `catalog:`
  // specifiers must be rewritten to real versions in the tarball, and only the
  // workspace's own package manager does that. If it ever failed, the npm install
  // below would reject the unrewritten specifier — which is the point of packing with
  // one tool and consuming with another.
  const tarballs = [];
  for (const pkg of PUBLISHED_PACKAGE_POLICIES) {
    const dir = join(repoRoot, pkg.directory);
    const output = run('pnpm', ['pack', '--pack-destination', scratch], dir);
    const file = output.trim().split('\n').pop().trim();
    tarballs.push(file.startsWith('/') ? file : join(scratch, file));
    console.log(`  packed ${pkg.name} -> ${basename(file)}`);
  }

  writeFileSync(
    join(scratch, 'package.json'),
    `${JSON.stringify(
      {
        name: 'kajay-pack-consumer',
        version: '1.0.0',
        private: true,
        type: 'module',
        dependencies: { react: '^19.2.8', 'react-dom': '^19.2.8' },
        // A TypeScript consumer of @kajay/react needs these: react is a peer
        // dependency, so its types are the consumer's to supply. The pack test
        // discovered this the way a real consumer would have.
        devDependencies: { '@types/react': '^19.2.18', '@types/react-dom': '^19.2.4' },
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  // Does the `exports` wiring actually resolve types for a consumer? `esm-only` is the
  // right profile: these packages are ESM-only by decision (ADR-0010), so node10
  // resolution failing and `require()` needing a dynamic import are intended
  // consequences, not defects. What this catches is the node16-ESM or bundler path
  // regressing — which would break every consumer silently.
  console.log('\nChecking published type resolution...');
  for (const tarball of tarballs) {
    try {
      run(join(repoRoot, 'node_modules', '.bin', 'attw'), [
        tarball,
        '--profile',
        'esm-only',
        '--entrypoints',
        '.',
      ]);
      console.log(`  types resolve: ${basename(tarball)}`);
    } catch (error) {
      failures.push({ spec: `attw ${basename(tarball)}`, installed: '-', detail: describeError(error) });
      console.log(`  TYPES WRONG:   ${basename(tarball)}`);
    }
  }

  console.log('\nInstalling tarballs as a third-party consumer would...');
  run('npm', ['install', '--no-audit', '--no-fund', '--silent'], scratch);
  run('npm', ['install', '--no-audit', '--no-fund', '--silent', ...tarballs], scratch);
  verifyInstalledRuntimeSurface(scratch);

  // skipLibCheck stays FALSE: the point is to deep-check the declarations we ship.
  // A pack test with skipLibCheck on would pass while shipping unusable types.
  writeFileSync(
    join(scratch, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: 'es2023',
          module: 'nodenext',
          moduleResolution: 'nodenext',
          jsx: 'react-jsx',
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          lib: ['es2023', 'dom'],
        },
        include: ['smoke.ts', 'creator.tsx'],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  writeFileSync(
    join(scratch, 'tsconfig.build.json'),
    `${JSON.stringify(
      {
        extends: './tsconfig.json',
        compilerOptions: { noEmit: false, outDir: 'built', skipLibCheck: true },
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  writeFileSync(join(scratch, 'smoke.ts'), SMOKE_TS, 'utf8');
  writeFileSync(join(scratch, 'creator.tsx'), CREATOR_TSX, 'utf8');

  console.log(`\nTypeScript compatibility matrix: ${SUPPORTED_TYPESCRIPT.join(', ')}`);
  for (const spec of SUPPORTED_TYPESCRIPT) {
    run('npm', ['install', '--no-audit', '--no-fund', '--silent', '--no-save', `typescript@${spec}`], scratch);
    const installed = run('node', ['node_modules/typescript/bin/tsc', '--version'], scratch).trim();
    try {
      run('node', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], scratch);
      console.log(`  PASS  ${spec.padEnd(10)} (${installed})`);
    } catch (error) {
      failures.push({ spec, installed, detail: describeError(error) });
      console.log(`  FAIL  ${spec.padEnd(10)} (${installed})`);
    }
  }

  // Resolve the public CSS subpaths from the installed package. Reading the internal
  // path alone proves `files`, but not that Node's package resolver can reach it through
  // the published interface a bundler consumes.
  console.log('');
  const stylesheets = verifyPublishedCss(scratch);
  proveBrokenCssExportFails(scratch);

  // The Creator's *own* chrome ships too — checklist N4. The designer, the property grid
  // and the assembly's layout all live in the same stylesheet as the survey's, and a
  // consumer who installed the Creator and got an unstyled one would have no way to tell
  // whether that was the library or their own build.
  const shipped = stylesheets.get('@kajay/themes/styles.css') ?? '';
  for (const rule of ['.kajay-creator__', '.kajay-designer__', '.kajay-properties__']) {
    if (!shipped.includes(rule)) {
      throw new Error(`Packed stylesheet is missing the Creator's ${rule} rules.`);
    }
  }
  console.log('  stylesheet covers the Creator');

  console.log('\nRunning the smoke scenario...');
  run('node', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.build.json'], scratch);

  // **The React consumer was really compiled.** `creator.tsx` is checked rather than run,
  // which means a build that quietly stopped including it would report nothing at all —
  // the worst kind of green. Its emitted output existing is the proof that the matrix
  // above actually type-checked the Creator's React half.
  if (!existsSync(join(scratch, 'built', 'creator.js'))) {
    throw new Error('creator.tsx was not compiled; the React consumer check did nothing.');
  }
  console.log('  React consumer compiled: creator.tsx');

  process.stdout.write(run('node', ['built/smoke.js'], scratch));

  if (failures.length === 0) {
    console.log('\nPack test passed.');
  }
} catch (error) {
  failures.push({ spec: '(harness)', installed: '-', detail: describeError(error) });
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error('\nPack test FAILED.\n');
  for (const { spec, installed, detail } of failures) {
    console.error(`  typescript@${spec} (${installed}):`);
    console.error(`${detail.split('\n').slice(0, 12).map((line) => `    ${line}`).join('\n')}\n`);
  }
  process.exit(1);
}
