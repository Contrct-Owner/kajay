import assert from 'node:assert/strict';
import test from 'node:test';
import { extractPageDefinitionsFromSource } from './pageRegistrySource.mjs';

test('page metadata is extracted without evaluating JSX content', () => {
  const source = `
    export const pages = [{
      slug: 'surveys/validation',
      title: 'Validation',
      description: 'Validation behavior.',
      section: 'Surveys',
      status: 'preview',
      audience: 'consumer',
      sdk: 'typescript',
      framework: 'react',
      toc: [{ id: 'timing', label: 'Timing', depth: 2 }],
      related: ['surveys/expressions'],
      content: <SomethingThatMustNotRun />,
    }];
  `;
  assert.deepEqual(extractPageDefinitionsFromSource(source, 'fixture.tsx'), [{
    source: 'fixture.tsx',
    slug: 'surveys/validation',
    title: 'Validation',
    description: 'Validation behavior.',
    section: 'Surveys',
    status: 'preview',
    audience: 'consumer',
    sdk: 'typescript',
    framework: 'react',
    toc: [{ id: 'timing', label: 'Timing', depth: 2 }],
    related: ['surveys/expressions'],
  }]);
});

test('non-page objects are ignored', () => {
  const source = `const unrelated = { slug: 'not-a-page', title: 'No content field' };`;
  assert.deepEqual(extractPageDefinitionsFromSource(source), []);
});
