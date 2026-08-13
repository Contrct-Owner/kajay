/**
 * Values the host supplies, addressed as `{$name}` — checklist B12,
 * [ADR-0047](../../../../docs/adr/0047-host-value-scope.md).
 *
 * A scope that is explicitly **not** the answer space. A host knows things the
 * definition does not and the respondent must not be asked — a tier, a balance, an
 * entitlement — and the only route into a survey before this one was `setValue`, which
 * makes that context an answer: in `data`, in the snapshot, and overwritable by the
 * person it describes.
 *
 * Unlike {@link ./endpoints.ts | endpoints}, which are constant for the session and
 * deliberately kept out of the dependency graph, a host value changes during one. That
 * difference is the whole reason it is a separate scope rather than a second use of the
 * existing sigil.
 */
export type HostValues = Readonly<Record<string, unknown>>;

/** The sigil that tells the two scopes apart. Collision is impossible by construction. */
const SIGIL = '$';

/** True for a reference naming a host value rather than an answer. */
export function isHostValueName(name: string): boolean {
  return name.startsWith(SIGIL);
}

/** The key a reference names, without its sigil. */
export function hostValueKey(name: string): string {
  return name.slice(SIGIL.length);
}

/**
 * The value a reference names, or `undefined` if the host supplied none.
 *
 * `undefined` rather than the empty string, which was the defect
 * [ADR-0017](../../../../docs/adr/0017-choices-url-environment-portability.md) found in
 * the endpoint scope. Here it is not merely safer but *correct*: every operator already
 * treats `undefined` as an unanswered question, so an absent host value behaves like
 * every other absent value and no operator needs a third state.
 *
 * Only the first segment of a path is resolved here. Descending `{$profile.plan.tier}`
 * is `createPathResolver`'s job and already works for any structured value.
 */
export function resolveHostValue(name: string, values: HostValues): unknown {
  return isHostValueName(name) ? values[hostValueKey(name)] : undefined;
}

/**
 * Whether the host declared this name at all.
 *
 * Distinct from resolving it, because a host may legitimately supply `undefined`, and a
 * diagnostic that could not tell that from "never mentioned" would nag about a value
 * that is deliberately absent.
 */
export function declaresHostValue(name: string, values: HostValues): boolean {
  return isHostValueName(name) && Object.hasOwn(values, hostValueKey(name));
}
