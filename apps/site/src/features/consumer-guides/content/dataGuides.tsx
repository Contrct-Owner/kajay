import type { GuideSectionDefinition } from '../components/GuideContent';
import { GuideNote, ResponsibilityList } from '../components/GuideContent';
import { RESPONSE_EVENTS, SAVE_PROGRESS } from '../examples/consumerExamples';

export const responseSections: readonly GuideSectionDefinition[] = [
  {
    id: 'read-and-change-answers',
    title: 'Read and change answers',
    body: <p>Read the current response from <code>survey.data</code>. Use <code>setValue</code> or <code>setData</code> for host-driven changes so expressions, validation, and typed events settle exactly as respondent input does.</p>,
  },
  {
    id: 'subscribe-to-events',
    title: 'Subscribe to events',
    body: <p>Event subscriptions return an unsubscribe function. Attach them once per survey lifetime and release them when the host component unmounts.</p>,
    code: RESPONSE_EVENTS,
    codeLabel: 'Submit on completion',
  },
  {
    id: 'submission-ownership',
    title: 'Submission ownership',
    body: <ResponsibilityList><li>Kajay decides when the survey reaches completion and emits the final data.</li><li>The author decides which questions, calculated values, and completion rules exist.</li><li>The host authenticates the respondent, submits data, handles retries, and records server outcomes.</li></ResponsibilityList>,
  },
];

export const progressSections: readonly GuideSectionDefinition[] = [
  {
    id: 'store-a-progress-snapshot',
    title: 'Store a progress snapshot',
    body: <p><code>survey.progress</code> is plain JSON containing answer data and the current page name. Save it after value and page changes, then delete it after completion.</p>,
    code: SAVE_PROGRESS,
    codeLabel: 'Save and restore progress',
  },
  {
    id: 'restore-before-rendering',
    title: 'Restore before rendering',
    body: <p>Restore after parsing and before the first render. Kajay restores answers first so conditional page visibility settles, then navigates by page name rather than a fragile numeric index.</p>,
  },
  {
    id: 'validate-stored-data',
    title: 'Validate stored data',
    body: <GuideNote><p>A stored snapshot is untrusted and may belong to an older definition. Validate its shape, version it with your survey record, and choose whether an incompatible snapshot should be migrated or discarded.</p></GuideNote>,
  },
  {
    id: 'autosave-policy',
    title: 'Autosave policy',
    body: <p>Kajay emits deterministic changes but does not debounce, persist, or resolve revisions. The host owns batching, offline queues, optimistic concurrency, encryption, and retention.</p>,
  },
];

