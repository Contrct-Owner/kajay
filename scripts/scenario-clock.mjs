/**
 * A lifecycle scenario's own clock.
 *
 * Corpus time is an instant named in the case file and seconds moved by an action, so a
 * conformance run never depends on how long it took or where it ran. A scenario that
 * names no clock still gets one — it simply never advances.
 */
export class ScenarioClock {
  #at;

  constructor(startedAt) {
    this.#at = Date.parse(startedAt ?? '2026-01-01T00:00:00.000Z');
  }

  now() {
    return new Date(this.#at);
  }

  advance(seconds) {
    this.#at += seconds * 1000;
  }
}
