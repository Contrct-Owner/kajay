import type { LogicEngineOptions } from '../logic/LogicEngine.js';
import type { ChoicePageLoader } from './ChoicePageLoader.js';
import type { ChoiceFetcher } from './ChoiceSourceController.js';

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
}
