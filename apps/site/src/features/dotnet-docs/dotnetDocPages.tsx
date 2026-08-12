import type { DocPageDefinition } from '../docs-shell/index.js';
import { DotnetCompatibilityGuide } from './content/DotnetCompatibilityGuide.js';
import { DotnetExtensibilityGuide } from './content/DotnetExtensibilityGuide.js';
import { DotnetHostingGuide } from './content/DotnetHostingGuide.js';
import { DotnetQuickstart } from './content/DotnetQuickstart.js';
import { DotnetSnapshotsGuide } from './content/DotnetSnapshotsGuide.js';

export const dotnetDocPages = [
  {
    slug: 'quickstart/dotnet',
    title: 'Run Kajay in .NET',
    description: 'Install Kajay.Core, parse a definition, and run a native headless survey session.',
    section: 'Start',
    status: 'stable',
    audience: 'consumer',
    sdk: 'dotnet',
    framework: 'neutral',
    related: ['dotnet/snapshots', 'dotnet/hosting'],
    toc: [
      { id: 'parse', label: 'Parse a definition', depth: 2 },
      { id: 'run', label: 'Run the survey', depth: 2 },
      { id: 'ownership', label: 'Keep ownership explicit', depth: 2 },
      { id: 'next', label: 'Where to go next', depth: 2 },
    ],
    content: <DotnetQuickstart />,
  },
  {
    slug: 'dotnet/snapshots',
    title: 'Persist and resume in .NET',
    description: 'Capture and restore definition-bound Response Snapshots while keeping storage policy in the host.',
    section: '.NET',
    status: 'stable',
    audience: 'consumer',
    sdk: 'dotnet',
    framework: 'neutral',
    related: ['quickstart/dotnet', 'dotnet/compatibility'],
    toc: [
      { id: 'capture', label: 'Capture runtime state', depth: 2 },
      { id: 'restore', label: 'Restore safely', depth: 2 },
      { id: 'host', label: 'Keep storage host-owned', depth: 2 },
    ],
    content: <DotnetSnapshotsGuide />,
  },
  {
    slug: 'dotnet/hosting',
    title: 'Connect .NET host services',
    description: 'Provide choices, files, validation, functions, endpoints, clocks, and cancellation through SurveyOptions.',
    section: '.NET',
    status: 'stable',
    audience: 'advanced',
    sdk: 'dotnet',
    framework: 'neutral',
    related: ['quickstart/dotnet', 'dotnet/extensibility'],
    toc: [
      { id: 'options', label: 'Compose SurveyOptions', depth: 2 },
      { id: 'async', label: 'Use async runtime APIs', depth: 2 },
      { id: 'cancellation', label: 'Handle cancellation', depth: 2 },
    ],
    content: <DotnetHostingGuide />,
  },
  {
    slug: 'dotnet/extensibility',
    title: 'Extend Kajay.Core',
    description: 'Compose immutable metadata registries and native custom question factories.',
    section: '.NET',
    status: 'stable',
    audience: 'extension',
    sdk: 'dotnet',
    framework: 'neutral',
    related: ['dotnet/hosting', 'dotnet/compatibility'],
    toc: [
      { id: 'registry', label: 'Compose a registry', depth: 2 },
      { id: 'questions', label: 'Register questions', depth: 2 },
      { id: 'boundaries', label: 'Keep boundaries portable', depth: 2 },
    ],
    content: <DotnetExtensibilityGuide />,
  },
  {
    slug: 'dotnet/compatibility',
    title: '.NET compatibility and support',
    description: 'Understand schema, conformance, snapshot, package, and runtime support contracts.',
    section: '.NET',
    status: 'stable',
    audience: 'advanced',
    sdk: 'dotnet',
    framework: 'neutral',
    related: ['quickstart/dotnet', 'dotnet/extensibility'],
    toc: [
      { id: 'versions', label: 'Compare contracts', depth: 2 },
      { id: 'conformance', label: 'Conformance claim', depth: 2 },
      { id: 'support', label: 'Package gates', depth: 2 },
    ],
    content: <DotnetCompatibilityGuide />,
  },
] as const satisfies readonly DocPageDefinition[];
