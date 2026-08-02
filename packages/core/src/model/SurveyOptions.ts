import type { LogicEngineOptions } from '../logic/LogicEngine.js';
import type { ChoiceFetcher } from './ChoiceSourceController.js';

/**
 * Everything a survey may be given at construction.
 *
 * `fetchJson` is supplied by the host rather than defaulted here because core is
 * DOM-free and dependency-free — it cannot reach for `fetch`, which keeps the engine
 * backend-agnostic by construction.
 */
export interface SurveyOptions extends LogicEngineOptions {
  readonly fetchJson?: ChoiceFetcher;
}
