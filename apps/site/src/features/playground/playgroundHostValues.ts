/**
 * The playground's stand-in for a host application's own context.
 *
 * A real host reads these from a session, a CRM or an entitlement service. The playground
 * has none of those, so it seeds plausible values and lets a visitor move them by hand —
 * which is the point: `{$name}` is the only scope a *definition* cannot author, so the
 * only way to show what it does is to let someone play the application.
 *
 * **Seeded, and deliberately not carried in a share link.** A link carries the definition
 * and nothing else, so a shared survey whose conditions read the host scope has to work on
 * arrival; defaults are what make that true. The values somebody was experimenting with
 * are theirs, not part of the document they shared.
 */
export type PlaygroundHostValues = {
  // A type alias rather than an interface on purpose: only an alias gets the implicit
  // index signature that lets it satisfy the runtime's `HostValues`, which is keyed by
  // whatever names a definition happens to use.
  readonly tier: string;
  readonly seats: number;
};

export const PLAYGROUND_HOST_VALUES: PlaygroundHostValues = {
  tier: 'bronze',
  seats: 12,
};

/** The tiers the panel offers. A host would have its own, from its own plan catalogue. */
export const PLAYGROUND_TIERS: readonly string[] = ['bronze', 'silver', 'gold'];
