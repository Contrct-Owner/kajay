import type { GuideSectionDefinition } from '../components/GuideContent';
import { GuideNote, ResponsibilityList } from '../components/GuideContent';
import { FILE_SEAMS, REMOTE_CHOICES, SERVER_VALIDATION } from '../examples/consumerExamples';

export const remoteSections: readonly GuideSectionDefinition[] = [
  {
    id: 'choose-a-loading-seam',
    title: 'Choose a loading seam',
    body: <p>Use <code>fetchJson</code> for an authored <code>choicesByUrl</code> list. Use <code>loadChoicePage</code> for server-filtered paging with <code>skip</code>, <code>take</code>, and the respondent&rsquo;s filter text.</p>,
    code: REMOTE_CHOICES,
    codeLabel: 'Host-owned choice loading',
  },
  {
    id: 'secure-remote-data',
    title: 'Secure remote data',
    body: <ResponsibilityList><li>Kajay requests choices and displays loading, failure, filtering, and pagination state.</li><li>The author selects the question and source metadata.</li><li>The host authenticates requests, restricts destinations, validates response shape, and observes failures.</li></ResponsibilityList>,
  },
  {
    id: 'named-endpoints',
    title: 'Prefer named endpoints for portable definitions',
    body: <GuideNote><p>When definitions move between environments, let the host map endpoint names to URLs instead of embedding deployment addresses in authored JSON. A respondent must never control the destination.</p></GuideNote>,
  },
  {
    id: 'server-validation',
    title: 'Add server validation',
    body: <p>A server validator receives the current data and question names under the active gate. Return errors by question name. Reject only for host or network failure; Kajay keeps that separate from an invalid answer.</p>,
    code: SERVER_VALIDATION,
    codeLabel: 'One validation request per gate',
  },
];

export const fileSections: readonly GuideSectionDefinition[] = [
  {
    id: 'choose-storage-mode',
    title: 'Choose storage mode',
    body: <p>With <code>storeDataAsText</code>, file content travels inside the response as a data URL. With an uploader, the host stores content and the answer keeps returned file metadata and a URL.</p>,
  },
  {
    id: 'provide-file-seams',
    title: 'Provide file seams',
    body: <p>Pass storage callbacks while parsing. Core never receives a DOM <code>File</code>; the React adapter converts selected or dropped files into plain <code>FileEntry</code> values.</p>,
    code: FILE_SEAMS,
    codeLabel: 'Upload and cleanup',
  },
  {
    id: 'file-lifecycle',
    title: 'Own the file lifecycle',
    body: <ResponsibilityList><li>Kajay enforces authored count, size, and accepted-type rules and reports upload state.</li><li>The author chooses limits and whether response data may carry content.</li><li>The host scans content, authorizes access, stores and deletes objects, mints download URLs, and applies retention policy.</li></ResponsibilityList>,
  },
  {
    id: 'failed-uploads',
    title: 'Handle failed uploads',
    body: <GuideNote><p>A failed upload leaves the previous answer unchanged and exposes an upload failure to the renderer. Do not submit until outstanding uploads have resolved, and make retry behavior explicit.</p></GuideNote>,
  },
];

