import type { DocPageDefinition, DocTableOfContentsItem } from '@/features/docs-shell';
import { GuideContent } from './components/GuideContent';
import type { GuideSectionDefinition } from './components/GuideContent';
import { progressSections, responseSections } from './content/dataGuides';
import {
  logicExtensionSections,
  questionExtensionSections,
  themeSections,
} from './content/extensionGuides';
import { fileSections, remoteSections } from './content/integrationGuides';
import {
  accessibilitySections,
  compatibilitySections,
  localizationSections,
} from './content/qualityGuides';

function tocOf(sections: readonly GuideSectionDefinition[]): readonly DocTableOfContentsItem[] {
  return sections.map(({ id, title }) => ({ id, label: title, depth: 2 }));
}

export const consumerGuidePages = [
  {
    slug: 'integration/responses-and-submission',
    title: 'Responses, events, and submission',
    description: 'Read survey data, react to typed lifecycle events, and submit results through your application.',
    section: 'Integration', status: 'preview', audience: 'consumer', sdk: 'typescript', framework: 'react',
    toc: tocOf(responseSections),
    content: <GuideContent sections={responseSections} />,
  },
  {
    slug: 'integration/save-and-resume',
    title: 'Save and resume progress',
    description: 'Persist plain progress snapshots and restore respondents without coupling Kajay to storage.',
    section: 'Integration', status: 'preview', audience: 'consumer', sdk: 'typescript', framework: 'neutral',
    toc: tocOf(progressSections),
    content: <GuideContent sections={progressSections} />,
  },
  {
    slug: 'integration/remote-data-and-validation',
    title: 'Remote choices and server validation',
    description: 'Connect host-owned data and validation services without giving the runtime network authority.',
    section: 'Integration', status: 'preview', audience: 'consumer', sdk: 'typescript', framework: 'neutral',
    toc: tocOf(remoteSections),
    content: <GuideContent sections={remoteSections} />,
  },
  {
    slug: 'integration/file-handling',
    title: 'Handle files',
    description: 'Choose response-embedded content or host storage and own the complete file lifecycle.',
    section: 'Integration', status: 'preview', audience: 'consumer', sdk: 'typescript', framework: 'react',
    toc: tocOf(fileSections),
    content: <GuideContent sections={fileSections} />,
  },
  {
    slug: 'customization/themes-and-components',
    title: 'Themes and design-system components',
    description: 'Use Kajay tokens for styling or substitute the controls your application already ships.',
    section: 'Customize', status: 'preview', audience: 'consumer', sdk: 'typescript', framework: 'react',
    toc: tocOf(themeSections),
    content: <GuideContent sections={themeSections} />,
  },
  {
    slug: 'customization/question-types',
    title: 'Custom question types and renderers',
    description: 'Register one metadata-driven model and render it through a cloned public renderer registry.',
    section: 'Customize', status: 'preview', audience: 'extension', sdk: 'typescript', framework: 'react',
    toc: tocOf(questionExtensionSections),
    content: <GuideContent sections={questionExtensionSections} />,
  },
  {
    slug: 'customization/validators-and-functions',
    title: 'Custom validators and expression functions',
    description: 'Add application rules while preserving deterministic validation and expression behavior.',
    section: 'Customize', status: 'preview', audience: 'extension', sdk: 'typescript', framework: 'neutral',
    toc: tocOf(logicExtensionSections),
    content: <GuideContent sections={logicExtensionSections} />,
  },
  {
    slug: 'surveys/localization-and-rtl',
    title: 'Localization and right-to-left layout',
    description: 'Author localized definition content, replace runtime strings, and switch direction safely.',
    section: 'Surveys', status: 'preview', audience: 'consumer', sdk: 'typescript', framework: 'neutral',
    toc: tocOf(localizationSections),
    content: <GuideContent sections={localizationSections} />,
  },
  {
    slug: 'surveys/accessibility',
    title: 'Build accessible surveys',
    description: 'Understand the accessibility responsibilities shared by Kajay, survey authors, and hosts.',
    section: 'Surveys', status: 'preview', audience: 'consumer', sdk: 'neutral', framework: 'neutral',
    toc: tocOf(accessibilitySections),
    content: <GuideContent sections={accessibilitySections} />,
  },
  {
    slug: 'help/compatibility-and-troubleshooting',
    title: 'Compatibility and troubleshooting',
    description: 'Start from tested compatibility and isolate failures at the definition, runtime, or host seam.',
    section: 'Help', status: 'preview', audience: 'consumer', sdk: 'typescript', framework: 'react',
    toc: tocOf(compatibilitySections),
    content: <GuideContent sections={compatibilitySections} />,
  },
] as const satisfies readonly DocPageDefinition[];

