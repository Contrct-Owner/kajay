import ts from 'typescript';

const BROWSER_RUNNERS = [
  '@playwright/test',
  '@vitest/browser',
  'playwright',
  'puppeteer',
  'vitest/browser',
  'vitest-browser-react',
  'webdriverio',
];
const FILESYSTEM_MODULES = new Set(['fs', 'fs/promises', 'node:fs', 'node:fs/promises']);
const NETWORK_MODULES = new Set([
  'http',
  'https',
  'net',
  'node:http',
  'node:https',
  'node:net',
  'node:tls',
  'tls',
  'undici',
]);
const MOCK_MODULES = new Set(['mock-require', 'proxyquire', 'testdouble']);
const REAL_TIMERS = ['setImmediate', 'setInterval', 'setTimeout'];
const NETWORK_GLOBALS = ['EventSource', 'WebSocket', 'XMLHttpRequest', 'fetch'];

function moduleSpecifier(node) {
  return ts.isStringLiteralLike(node) ? node.text : null;
}

function calledName(expression) {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }
  if (ts.isPropertyAccessExpression(expression)) {
    const owner = calledName(expression.expression);
    return owner === null ? expression.name.text : `${owner}.${expression.name.text}`;
  }
  return null;
}

function addImportViolation(specifier, node, add) {
  if (specifier === '@vitest/browser/context') {
    add('deprecated-browser-context', node, 'Use the current browser runner interface.');
  } else if (BROWSER_RUNNERS.some((name) => specifier === name || specifier.startsWith(`${name}/`))) {
    add('browser-runner', node, `Unit tests cannot import "${specifier}".`);
  } else if (specifier === 'jsdom' || specifier.startsWith('jsdom/')) {
    add('jsdom', node, 'jsdom is banned; DOM behavior belongs in real-browser tests.');
  } else if (FILESYSTEM_MODULES.has(specifier)) {
    add('filesystem', node, `Unit tests cannot access the filesystem through "${specifier}".`);
  } else if (NETWORK_MODULES.has(specifier)) {
    add('network', node, `Unit tests cannot access the network through "${specifier}".`);
  } else if (MOCK_MODULES.has(specifier)) {
    add('mocking-framework', node, `Unit tests cannot import "${specifier}".`);
  }
}

function inspectCall(node, add) {
  const name = calledName(node.expression);
  if (name === 'require' || node.expression.kind === ts.SyntaxKind.ImportKeyword) {
    const specifier = moduleSpecifier(node.arguments[0]);
    if (specifier !== null) {
      addImportViolation(specifier, node, add);
    }
  }
  if (name !== null && REAL_TIMERS.some((timer) => name === timer || name.endsWith(`.${timer}`))) {
    add('real-timer', node, `Use fake timers or an observable promise instead of ${name}().`);
  }
  if (name !== null && NETWORK_GLOBALS.some((global) => name === global || name.endsWith(`.${global}`))) {
    add('network', node, `Unit tests cannot access the network through ${name}().`);
  }
  if (name !== null && /(?:^|\.)(?:doMock|mock|unstable_mockModule)$/u.test(name)) {
    const target = moduleSpecifier(node.arguments[0]);
    if (target?.startsWith('@kajay/') === true) {
      add('own-package-mock', node, `Use the real ${target} package in unit tests.`);
    }
  }
}

/** Returns policy violations without reading files, so every rule is mutation-testable. */
export function checkUnitTestSource(source, file = '<source>') {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const violations = [];
  let pollingWait;
  let usesFakeTimers = false;
  const add = (rule, node, detail) => {
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    violations.push({ file, line: position.line + 1, rule, detail });
  };

  const visit = (node) => {
    if (ts.isImportDeclaration(node)) {
      const specifier = moduleSpecifier(node.moduleSpecifier);
      if (specifier !== null) {
        addImportViolation(specifier, node, add);
      }
    } else if (ts.isCallExpression(node)) {
      inspectCall(node, add);
      const name = calledName(node.expression);
      if (name === 'vi.waitFor' || name === 'vitest.waitFor') {
        pollingWait ??= node;
      } else if (name === 'vi.useFakeTimers' || name === 'vitest.useFakeTimers') {
        usesFakeTimers = true;
      }
    } else if (ts.isNewExpression(node)) {
      const name = calledName(node.expression);
      if (name !== null && NETWORK_GLOBALS.some((global) => name === global || name.endsWith(`.${global}`))) {
        add('network', node, `Unit tests cannot access the network through new ${name}().`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (pollingWait !== undefined && !usesFakeTimers) {
    add('real-timer', pollingWait, 'vi.waitFor must run under fake timers in a unit test.');
  }
  return violations;
}
