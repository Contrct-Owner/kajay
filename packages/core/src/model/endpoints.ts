import type { Diagnostic } from '../serialization/Diagnostic.js';
import { placeholderNames } from './interpolate.js';

/**
 * Origins the host supplies, addressed as `{@name}` — checklist B11,
 * [ADR-0017](../../../../docs/adr/0017-choices-url-environment-portability.md).
 *
 * A scope that is explicitly **not** the answer space. A definition that named an
 * absolute origin would stop being the artifact that was tested the moment someone
 * rewrote it for production, and one that took the origin from an answer would hand a
 * respondent the choice of where the survey fetches from.
 */
export type Endpoints = Readonly<Record<string, string>>;

/** The sigil that tells the two scopes apart. Collision is impossible by construction. */
const SIGIL = '@';

/** True for a placeholder naming an endpoint rather than an answer. */
export function isEndpointName(name: string): boolean {
  return name.startsWith(SIGIL);
}

/**
 * The endpoint a placeholder names, or undefined if it names an answer.
 *
 * Substituted **verbatim**, with no percent-encoding: this is a URL prefix, not a value
 * inside one. The opposite rule applies to `{answer}` placeholders, and for the same
 * reason — an encoded origin is a broken request, and an unencoded answer is a way for
 * a respondent to reach a different host.
 */
export function resolveEndpoint(name: string, endpoints: Endpoints): string | undefined {
  return isEndpointName(name) ? endpoints[name.slice(SIGIL.length)] : undefined;
}

/**
 * Endpoint names a template uses that the host did not supply.
 *
 * Reported rather than silently emptied, which is the single largest improvement over
 * substituting the empty string: `{@usersApi}/users` becoming `/users` sends the request
 * to the app's own origin, where it either 404s confusingly or — worse — succeeds
 * against something that was never meant to answer it.
 */
export function undeclaredEndpoints(
  template: string,
  endpoints: Endpoints,
): readonly string[] {
  return placeholderNames(template).filter(
    (name) => isEndpointName(name) && resolveEndpoint(name, endpoints) === undefined,
  );
}

/**
 * Every undeclared endpoint a survey's URLs name, as diagnostics.
 *
 * At **error** severity: a definition asking for an origin nobody supplied cannot load
 * its choices, and a warning would let it ship looking healthy. Reported once per
 * question, pointing at the question, because that is where an author can act on it.
 */
export function collectEndpointDiagnostics(
  questions: readonly { readonly name: string; readonly choicesByUrl: string }[],
  endpoints: Endpoints,
): readonly Diagnostic[] {
  return questions.flatMap((question) =>
    undeclaredEndpoints(question.choicesByUrl, endpoints).map((name) => ({
      severity: 'error' as const,
      code: 'undeclared-endpoint',
      message: `"${question.name}" loads choices from ${JSON.stringify(name)}, which no endpoint supplies. Pass it as the endpoints option.`,
      path: `/${question.name}`,
    })),
  );
}
