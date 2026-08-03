import type { LogicEngineOptions } from '../logic/LogicEngine.js';
import type { ChoicePageLoader } from './ChoicePageLoader.js';
import type { Endpoints } from './endpoints.js';
import type { ChoiceFetcher } from './ChoiceSourceController.js';
import type { FileCleaner, FileDownloader, FileUploader } from './FileEntry.js';

/**
 * Everything a survey may be given at construction.
 *
 * `fetchJson` and `loadChoicePage` are supplied by the host rather than defaulted here
 * because core is DOM-free and dependency-free — it cannot reach for `fetch`, which
 * keeps the engine backend-agnostic by construction. They are two seams rather than
 * one because they are asked different things: `fetchJson` fetches a whole list from a
 * URL the definition names, and `loadChoicePage` answers "the next twenty, matching
 * this" against an API only the host knows the shape of.
 */
export interface SurveyOptions extends LogicEngineOptions {
  readonly fetchJson?: ChoiceFetcher;
  readonly loadChoicePage?: ChoicePageLoader;
  /**
   * Origins a definition addresses as `{@name}` (ADR-0017).
   *
   * The host's, never the definition's: the artifact promoted to production is then
   * the one that was tested, and a respondent can never influence where the survey
   * fetches from.
   */
  readonly endpoints?: Endpoints;
  /**
   * Where attached files go — checklist H1 and H3.
   *
   * Injected for the same reason `fetchJson` is: core cannot reach for `fetch`, and
   * where a file is stored is a decision only the host can take. Without one the content
   * stays in the response if the definition says `storeDataAsText`, and otherwise only
   * the file's description does — never a reference to something nobody stored.
   */
  readonly uploadFiles?: FileUploader;
  /** Mints a URL for a stored file, when one has to be asked for rather than kept. */
  readonly downloadFile?: FileDownloader;
  /** Told when files leave an answer, so a host can delete what it stored. */
  readonly clearFiles?: FileCleaner;
}
