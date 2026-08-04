import type { GuideSectionDefinition } from '../components/GuideContent';
import { GuideNote, ResponsibilityList } from '../components/GuideContent';
import { LOCALIZATION, TROUBLESHOOTING } from '../examples/consumerExamples';

export const localizationSections: readonly GuideSectionDefinition[] = [
  {
    id: 'author-localized-content',
    title: 'Author localized content',
    body: <p>Localizable definition properties accept either a string or an object with <code>default</code> and locale keys. Resolution falls back from a regional locale to its base language and then to the default value.</p>,
    code: LOCALIZATION,
    codeLabel: 'Content, UI strings, and RTL',
  },
  {
    id: 'switch-runtime-locale',
    title: 'Switch runtime locale',
    body: <p>Call <code>survey.setLocale</code> for the respondent&rsquo;s language. This changes displayed authored content and library strings without rewriting the definition&rsquo;s authored locale.</p>,
  },
  {
    id: 'right-to-left-layout',
    title: 'Right-to-left layout',
    body: <p>With <code>textDirection: 'auto'</code>, Kajay derives direction from the locale and places <code>dir</code> on the survey root. Authors must still provide translated content; hosts must test custom components and surrounding layout in both directions.</p>,
  },
];

export const accessibilitySections: readonly GuideSectionDefinition[] = [
  {
    id: 'what-kajay-provides',
    title: 'What Kajay provides',
    body: <ResponsibilityList><li>Semantic labels, error associations, live announcements, keyboard navigation, focus movement, and read-only semantics.</li><li>Real-browser coverage for shipped renderers and default primitives.</li><li>RTL direction and accessible state for validation and loading.</li></ResponsibilityList>,
  },
  {
    id: 'what-authors-provide',
    title: 'What survey authors provide',
    body: <ResponsibilityList><li>Clear question titles, instructions, choice text, and validation wording.</li><li>Alternative text and meaningful context for images and media.</li><li>Logic and page flow that do not strand or surprise respondents.</li></ResponsibilityList>,
  },
  {
    id: 'what-hosts-provide',
    title: 'What host applications provide',
    body: <ResponsibilityList><li>Accessible substituted components and custom renderers.</li><li>Sufficient contrast, zoom/reflow support, landmarks, page titles, and surrounding focus management.</li><li>Keyboard, screen-reader, axe, RTL, and high-contrast testing in supported browsers.</li></ResponsibilityList>,
  },
];

export const compatibilitySections: readonly GuideSectionDefinition[] = [
  {
    id: 'tested-platforms',
    title: 'Tested platforms',
    body: <p>Kajay is ESM-only, React 19, and tested in real Chromium. Published declarations are designed for TypeScript 5.5 and newer and are checked with TypeScript 6 and 7. Firefox and WebKit are not support claims until they join CI.</p>,
  },
  {
    id: 'diagnose-a-problem',
    title: 'Start with observable state',
    body: <p>Keep parse diagnostics and subscribe at the boundary you are debugging. A definition problem, answer change, validation wait, and failed network seam are different states and should not collapse into one generic error.</p>,
    code: TROUBLESHOOTING,
    codeLabel: 'Diagnostic instrumentation',
  },
  {
    id: 'common-failures',
    title: 'Common failures',
    body: <ResponsibilityList><li><strong>Definition will not parse:</strong> inspect diagnostic code and path; validate generated JSON against the committed schema.</li><li><strong>Logic looks stale:</strong> use <code>setValue</code>, not direct data mutation, and confirm referenced names and function registrations.</li><li><strong>Validation never finishes:</strong> ensure every async validator resolves and distinguish a rejected server request from respondent errors.</li><li><strong>Remote choices are empty:</strong> supply the matching loader, check response shape, and inspect host authentication or endpoint mapping.</li><li><strong>Custom controls do not respond:</strong> forward all contract props, handlers, ids, ARIA attributes, and refs.</li></ResponsibilityList>,
  },
  {
    id: 'reporting-issues',
    title: 'Prepare a useful reproduction',
    body: <GuideNote><p>Reduce the problem to one definition, record diagnostics and browser, and reproduce with shipped components before adding host substitutions. Use the Playground for definition-only failures; include host seam code for integration failures.</p></GuideNote>,
  },
];
