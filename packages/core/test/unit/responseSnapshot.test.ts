import { parseSurvey, parseSurveySnapshot } from '@kajay/core';
import type { Survey, SurveySnapshot } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

const DEFINITION: Readonly<Record<string, unknown>> = {
  pages: [
    { name: 'start', elements: [{ type: 'text', name: 'when' }] },
    { name: 'details', elements: [{ type: 'text', name: 'note' }] },
  ],
};

class TestClock {
  #at = Date.parse('2030-04-05T06:00:00.000Z');

  readonly now = (): Date => new Date(this.#at);

  advance(seconds: number): void {
    this.#at += seconds * 1000;
  }
}

function build(clock?: TestClock, definition: Readonly<Record<string, unknown>> = DEFINITION): Survey {
  return parseSurvey(
    definition,
    createTestRegistry(),
    clock === undefined ? {} : { now: clock.now },
  ).survey;
}

function stored(snapshot: SurveySnapshot): SurveySnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as SurveySnapshot;
}

describe('response snapshot v1', () => {
  test('parity/E6-portable-response-snapshot: an instant survives JSON storage', () => {
    const source = build();
    const instant = new Date('2030-04-05T06:07:08.009Z');
    source.setValue('when', instant);
    source.nextPage();

    source.setValue('nested', {
      instant,
      text: '2030-04-05T06:07:08.009Z',
      items: [instant, undefined],
    });
    const snapshot = parseSurveySnapshot(JSON.stringify(source.createSnapshot()));
    const restored = build();
    restored.restoreSnapshot(snapshot);

    expect(snapshot.formatVersion).toBe(1);
    expect(snapshot.definitionDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(snapshot.pageName).toBe('details');
    expect(restored.getValue('when')).toEqual(instant);
    expect(restored.getValue('nested')).toEqual({
      instant,
      text: '2030-04-05T06:07:08.009Z',
      items: [instant, undefined],
    });
    expect(restored.currentPage?.name).toBe('details');
  });

  test('rehydration does not replay runtime events', () => {
    const source = build();
    source.setValue('when', 'answered');
    source.nextPage();
    source.setLocale('fr');
    source.status.enterPreview();

    const restored = build();
    const events: string[] = [];
    restored.onValueChanged.add(() => events.push('value'));
    restored.onCurrentPageChanged.add(() => events.push('page'));
    restored.onLocaleChanged.add(() => events.push('locale'));
    restored.onStateChanged.add(() => events.push('state'));
    restored.onComplete.add(() => events.push('complete'));

    restored.restoreSnapshot(stored(source.createSnapshot()));

    expect(restored.status.state).toBe('preview');
    expect(events).toEqual([]);
  });

  test('a running timer counts time spent outside the process', () => {
    const timedDefinition = { ...DEFINITION, maxTimeToFinish: 10 };
    const clock = new TestClock();
    const source = build(clock, timedDefinition);
    source.timer.start();
    clock.advance(3);
    const snapshot = stored(source.createSnapshot());

    clock.advance(8);
    const restored = build(clock, timedDefinition);
    restored.restoreSnapshot(snapshot);

    expect(snapshot.timer).toEqual({
      surveyStartedAt: '2030-04-05T06:00:00.000Z',
      pageStartedAt: '2030-04-05T06:00:00.000Z',
    });
    expect(restored.timer.surveyTime.elapsed).toBe(11);
    restored.timer.tick();
    expect(restored.isCompleted).toBe(true);
  });

  test('an unsupported format is rejected before the survey changes', () => {
    const source = build();
    source.setValue('when', 'stored');
    const unsupported = {
      ...source.createSnapshot(),
      formatVersion: 2,
    } as unknown as SurveySnapshot;
    const restored = build();
    restored.setValue('when', 'still here');

    expect(() => restored.restoreSnapshot(unsupported)).toThrow(/format version 2/u);
    expect(restored.getValue('when')).toBe('still here');
  });

  test('restore replaces answers and falls back to the first visible page', () => {
    const source = build();
    source.setValue('when', 'stored');
    const snapshot = {
      ...stored(source.createSnapshot()),
      pageName: 'missing-page',
    };
    const restored = build();
    restored.setValue('old', 'must disappear');
    restored.nextPage();

    restored.restoreSnapshot(snapshot);

    expect(restored.data).toEqual({ when: 'stored' });
    expect(restored.currentPage?.name).toBe('start');
  });

  test('definition mismatch is rejected before any mutation', () => {
    const source = build();
    source.setValue('when', 'stored');
    const restored = build(undefined, {
      pages: [{ name: 'different', elements: [{ type: 'text', name: 'other' }] }],
    });
    restored.setValue('other', 'unchanged');

    expect(() => restored.restoreSnapshot(stored(source.createSnapshot())))
      .toThrow(/definition digest/u);
    expect(restored.data).toEqual({ other: 'unchanged' });
    expect(restored.currentPage?.name).toBe('different');
  });

  test('restore replaces the existing durable lifecycle', () => {
    const source = build();
    source.setValue('when', 'running');
    const restored = build();
    restored.status.enterPreview();

    restored.restoreSnapshot(stored(source.createSnapshot()));

    expect(restored.status.state).toBe('running');
  });

  test('definition identity is portable for unicode and large numbers', () => {
    const definition = {
      schemaVersion: 1,
      title: 'Café ☕',
      pages: [{
        name: 'start',
        elements: [{ type: 'text', name: 'amount', maxLength: 100_000_000_000_000_000_000 }],
      }],
    };

    expect(parseSurvey(definition, createTestRegistry()).definitionDigest).toBe(
      'sha256:145422a29290589ffa967406f8e75d13d4e6c36e53051e1746513fafb08d384f',
    );
  });
});
