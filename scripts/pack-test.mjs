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
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PACKAGES = ['core', 'react', 'creator-core', 'creator-react', 'themes'];

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

const scratch = mkdtempSync(join(tmpdir(), 'kajay-pack-'));
const failures = [];

try {
  console.log(`Scratch project: ${scratch}`);

  const tarballs = [];
  for (const pkg of PACKAGES) {
    const dir = join(repoRoot, 'packages', pkg);
    const output = run('npm', ['pack', '--pack-destination', scratch, '--silent'], dir);
    const file = output.trim().split('\n').pop().trim();
    tarballs.push(join(scratch, file));
    console.log(`  packed ${pkg} -> ${file}`);
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
        include: ['smoke.ts'],
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

  writeFileSync(
    join(scratch, 'smoke.ts'),
    `import {
  CURRENT_SCHEMA_VERSION,
  parseSurvey,
  serializeSurvey,
  globalRegistry,
  type SurveyDefinition,
} from '@kajay/core';
import { listToolboxItems } from '@kajay/creator-core';
import { lightTheme } from '@kajay/themes';
import { defaultQuestionRenderers } from '@kajay/react';

const definition: SurveyDefinition = {
  title: 'Pack smoke',
  pages: [{ name: 'p1', elements: [{ type: 'text', name: 'q1', keptUnknown: 'yes' }] }],
};

const first = parseSurvey(definition);
const canonical = serializeSurvey(first.survey);
const second = serializeSurvey(parseSurvey(canonical).survey);

if (JSON.stringify(canonical) !== JSON.stringify(second)) {
  throw new Error('Round-trip is not a fixed point.');
}
if (canonical['schemaVersion'] !== CURRENT_SCHEMA_VERSION) {
  throw new Error('schemaVersion missing from canonical output.');
}
if (!first.diagnostics.some((d) => d.code === 'unknown-property')) {
  throw new Error('Unknown property was not surfaced as a diagnostic.');
}
if (!globalRegistry.hasClass('text')) {
  throw new Error('Built-in types are not registered.');
}
if (listToolboxItems().length === 0) {
  throw new Error('Toolbox derived no items from the registry.');
}
if (!defaultQuestionRenderers.has('text')) {
  throw new Error('Default renderers are missing the text question.');
}
if (lightTheme.name !== 'light') {
  throw new Error('Theme preset did not load.');
}

console.log('pack smoke: ok');
`,
    'utf8',
  );

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

  // The stylesheets must actually be inside the tarball. A `files` field that omits
  // them is invisible in a workspace build and breaks every consumer.
  console.log('');
  for (const asset of ['styles/styles.css', 'styles/themes/dark.css']) {
    const content = readFileSync(join(scratch, 'node_modules', '@kajay', 'themes', asset), 'utf8');
    if (!content.includes('--kajay-')) {
      throw new Error(`Packed stylesheet ${asset} does not contain Kajay tokens.`);
    }
    console.log(`  stylesheet present: ${asset}`);
  }

  console.log('\nRunning the smoke scenario...');
  run('node', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.build.json'], scratch);
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
