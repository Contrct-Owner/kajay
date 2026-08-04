import { ExpressionsGuide } from './content/ExpressionsGuide.js';
import { RuntimeQuickstart } from './content/RuntimeQuickstart.js';
import { ValidationGuide } from './content/ValidationGuide.js';
import type { RuntimeDocPage } from './types.js';

export const runtimeDocPages: readonly RuntimeDocPage[] = [
  {
    slug: 'quickstart/runtime',
    title: 'Render your first survey',
    description: 'Define, parse, render, and submit a Kajay survey with TypeScript and React.',
    section: 'Start',
    status: 'preview',
    audience: 'consumer',
    sdk: 'typescript',
    framework: 'react',
    toc: [
      { id: 'define', label: 'Define the survey', depth: 2 },
      { id: 'render', label: 'Parse and render it', depth: 2 },
      { id: 'try', label: 'Try the result', depth: 2 },
      { id: 'next', label: 'Where to go next', depth: 2 },
    ],
    content: <RuntimeQuickstart />,
  },
  {
    slug: 'surveys/expressions',
    title: 'Expressions and conditional logic',
    description: 'Make survey state react to answers with references, conditions, and functions.',
    section: 'Surveys',
    status: 'preview',
    audience: 'consumer',
    sdk: 'neutral',
    framework: 'neutral',
    toc: [
      { id: 'conditions', label: 'Conditional state', depth: 2 },
      { id: 'references', label: 'Answer references', depth: 2 },
      { id: 'evaluate', label: 'Try an expression', depth: 2 },
      { id: 'failure', label: 'Malformed logic', depth: 2 },
      { id: 'more', label: 'Other expression uses', depth: 2 },
    ],
    content: <ExpressionsGuide />,
  },
  {
    slug: 'surveys/validation',
    title: 'Validation',
    description: 'Require answers, run authored and host checks, and handle asynchronous validation.',
    section: 'Surveys',
    status: 'preview',
    audience: 'consumer',
    sdk: 'typescript',
    framework: 'neutral',
    toc: [
      { id: 'authored', label: 'Authored validation', depth: 2 },
      { id: 'timing', label: 'When errors appear', depth: 2 },
      { id: 'host', label: 'Host and server rules', depth: 2 },
      { id: 'async', label: 'Pending validation', depth: 2 },
      { id: 'programmatic', label: 'Programmatic checks', depth: 2 },
    ],
    content: <ValidationGuide />,
  },
];
