import { SaveController, sameDefinition } from '@kajay/creator-core';
import type { SurveyDefinition } from '@kajay/core';
import { describe, expect, test } from 'vitest';

/** The save seam — checklist N1. No clock anywhere in it, which is the design. */
interface Deferred {
  readonly promise: Promise<boolean>;
  settle: (ok: boolean) => void;
}

function noop(): void {}

/** A save a test finishes by hand, which is how "no clock" is checked without one. */
function deferred(): Deferred {
  const made: Deferred = { promise: Promise.resolve(false), settle: noop };
  return Object.assign(made, {
    promise: new Promise<boolean>((resolve) => {
      made.settle = resolve;
    }),
  });
}

describe('parity/N1-save', () => {
  test('a save runs and reports what happened', async () => {
    const saved: SurveyDefinition[] = [];
    const controller = new SaveController((definition) => {
      saved.push(definition);
      return true;
    });

    expect(controller.state).toBe('idle');
    controller.request({ title: 'a' });
    expect(controller.state).toBe('saving');

    await Promise.resolve();
    await Promise.resolve();
    expect(controller.state).toBe('saved');
    expect(saved).toEqual([{ title: 'a' }]);
  });

  test('a saver that says no is a failure, and so is one that throws', async () => {
    const refused = new SaveController(() => false);
    refused.request({});
    await Promise.resolve();
    await Promise.resolve();
    expect(refused.state).toBe('failed');

    const threw = new SaveController(() => {
      throw new Error('offline');
    });
    threw.request({});
    await Promise.resolve();
    await Promise.resolve();
    // The Creator has nothing useful to add to the host's own error, and swallowing it is
    // what stops one failed save taking the designer's work down with it.
    expect(threw.state).toBe('failed');
  });

  test('requests arriving during a save are absorbed into one', async () => {
    const first = deferred();
    const seen: SurveyDefinition[] = [];
    const controller = new SaveController((definition) => {
      seen.push(definition);
      return seen.length === 1 ? first.promise : true;
    });

    controller.request({ title: 'one' });
    controller.request({ title: 'two' });
    controller.request({ title: 'three' });
    // Only the first has gone out; the others are one pending save, not three.
    expect(seen).toEqual([{ title: 'one' }]);

    first.settle(true);
    await first.promise;
    await Promise.resolve();
    await Promise.resolve();

    // The *latest* is what went, because a backend that only ever wanted the last one
    // should not receive a request per keystroke.
    expect(seen).toEqual([{ title: 'one' }, { title: 'three' }]);
  });

  test('a save that is already out of date does not report success', async () => {
    const first = deferred();
    // The second never settles, so the state can be observed while it is still running.
    const second = deferred();
    let calls = 0;
    const controller = new SaveController(() => {
      calls += 1;
      return calls === 1 ? first.promise : second.promise;
    });
    controller.request({ title: 'one' });
    controller.request({ title: 'two' });

    first.settle(true);
    await first.promise;
    await Promise.resolve();
    await Promise.resolve();

    // Reporting `saved` between the two would flicker through a state that was never true
    // of what is on screen: the first save's answer is already out of date.
    expect(calls).toBe(2);
    expect(controller.state).toBe('saving');
  });

  test('a coalesced burst never announces success in the middle of itself', async () => {
    const first = deferred();
    const states: string[] = [];
    let calls = 0;
    const controller = new SaveController(() => {
      calls += 1;
      return calls === 1 ? first.promise : true;
    });
    controller.onChanged.add(() => {
      states.push(controller.state);
    });

    controller.request({ title: 'one' });
    controller.request({ title: 'two' });
    first.settle(true);
    await first.promise;
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // `saving`, `saving`, `saved` — never a `saved` between the two, which would be a
    // state that was true of nothing on screen.
    expect(states).toEqual(['saving', 'saving', 'saved']);
  });

  test('it announces every change of state', async () => {
    const states: string[] = [];
    const controller = new SaveController(() => true);
    controller.onChanged.add(() => {
      states.push(controller.state);
    });

    controller.request({});
    await Promise.resolve();
    await Promise.resolve();

    expect(states).toEqual(['saving', 'saved']);
  });

  test('it says while a save is running, so a button can refuse a second press', async () => {
    const first = deferred();
    const controller = new SaveController(() => first.promise);

    controller.request({});
    expect(controller.isSaving).toBe(true);

    first.settle(true);
    await first.promise;
    await Promise.resolve();
    expect(controller.isSaving).toBe(false);
  });
});

describe('parity/N1-controlled', () => {
  test('two definitions are the same when they say the same thing', () => {
    // Compared as canonical JSON, because every read of `definition` builds a fresh object:
    // a controlled component comparing by identity would call `onChange` forever.
    expect(sameDefinition({ title: 'a' }, { title: 'a' })).toBe(true);
    expect(sameDefinition({ title: 'a' }, { title: 'b' })).toBe(false);
    expect(sameDefinition(undefined, undefined as SurveyDefinition | undefined)).toBe(true);
    expect(sameDefinition(undefined, {})).toBe(false);
  });
});
