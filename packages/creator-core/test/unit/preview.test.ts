import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import {
  DesignSurface,
  PREVIEW_DEVICES,
  PreviewSession,
  previewDevice,
} from '@kajay/creator-core';
import { previewViewport } from '../../src/previewDevices.js';
import { afterEach, describe, expect, test } from 'vitest';

/** Running the survey being designed — checklist M3. */
const BASIC: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'text', name: 'who', title: 'Your name' },
        { type: 'text', name: 'why', title: 'Why?', visibleIf: "{who} = 'ada'" },
      ],
    },
    { name: 'p2', elements: [{ type: 'text', name: 'notes' }] },
  ],
};

const open: PreviewSession[] = [];

function surface(definition: SurveyDefinition = BASIC): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return new DesignSurface({ definition, registry });
}

function session(designed: DesignSurface, options = {}): PreviewSession {
  const preview = new PreviewSession(designed, options);
  open.push(preview);
  return preview;
}

afterEach(() => {
  for (const preview of open.splice(0)) {
    preview.dispose();
  }
});

describe('parity/M3-preview', () => {
  test('the run is a different survey from the one on the canvas', () => {
    const designed = surface();

    const preview = session(designed);

    // The canvas is in design mode, where every question refuses an answer (E7). A
    // preview has to be the opposite, and must not be able to write into the document
    // being designed either.
    expect(preview.survey).not.toBe(designed.survey);
    expect(designed.survey.isDesignMode).toBe(true);
    expect(preview.survey.isDesignMode).toBe(false);
  });

  test('answering the preview leaves the design alone', () => {
    const designed = surface();
    const preview = session(designed);

    preview.survey.setValue('who', 'ada');

    expect(preview.data['who']).toBe('ada');
    // `data` is the response and the definition is the document (E6). A preview that
    // leaked either way would be the Creator writing answers into somebody's survey —
    // asserted on the model rather than by searching the JSON, because `ada` is also the
    // value the fixture's own `visibleIf` compares against.
    expect(designed.survey.getQuestionByName('who')?.value).toBeUndefined();
    expect(designed.definition['data']).toBeUndefined();
  });

  test('the logic the designer just wrote actually runs', () => {
    const designed = surface();
    const preview = session(designed);

    expect(preview.survey.getQuestionByName('why')?.isVisible).toBe(false);
    preview.survey.setValue('who', 'ada');
    expect(preview.survey.getQuestionByName('why')?.isVisible).toBe(true);
  });

  test('a fresh parse is what makes an edited expression real', () => {
    const designed = surface();
    const preview = session(designed);
    const why = designed.survey.getQuestionByName('why');

    designed.setProperty(why!, 'visibleIf', "{who} = 'grace'");
    preview.survey.setValue('who', 'grace');

    // Property edits mutate the model in place and do not rebuild the logic graph — L1's
    // named gap. The preview re-parses, which is what closes it.
    expect(preview.survey.getQuestionByName('why')?.isVisible).toBe(true);
  });
});

describe('parity/M3-preview-follows', () => {
  test('an untouched run follows the design without being asked', () => {
    const designed = surface();
    const preview = session(designed);
    const started = preview.run;

    designed.setProperty(designed.survey.getQuestionByName('who')!, 'title', 'Name');

    // Nothing to lose, so nothing is lost. A designer who tweaks a title and looks at the
    // preview should see the title, not a notice about it.
    expect(preview.run).toBeGreaterThan(started);
    expect(preview.isStale).toBe(false);
    expect(preview.survey.getQuestionByName('who')?.title).toBe('Name');
  });

  test('a touched run says so instead, and keeps the answers', () => {
    const designed = surface();
    const preview = session(designed);
    preview.survey.setValue('who', 'ada');
    const started = preview.run;

    designed.setProperty(designed.survey.getQuestionByName('who')!, 'title', 'Name');

    expect(preview.isTouched).toBe(true);
    expect(preview.run).toBe(started);
    expect(preview.isStale).toBe(true);
    expect(preview.data['who']).toBe('ada');
  });

  test('restarting takes the edit and drops the answers, because that is what it is', () => {
    const designed = surface();
    const preview = session(designed);
    preview.survey.setValue('who', 'ada');
    designed.setProperty(designed.survey.getQuestionByName('who')!, 'title', 'Name');

    preview.restart();

    expect(preview.isStale).toBe(false);
    expect(preview.isTouched).toBe(false);
    expect(preview.survey.getQuestionByName('who')?.title).toBe('Name');
    expect(preview.data['who']).toBeUndefined();
  });

  test('turning a page counts as having something to lose', () => {
    const designed = surface();
    const preview = session(designed);

    preview.survey.nextPage();

    expect(preview.isTouched).toBe(true);
  });

  test('a selection is not an edit', () => {
    const designed = surface();
    const preview = session(designed);
    preview.survey.setValue('who', 'ada');

    designed.select(designed.survey.getQuestionByName('who')!);

    // The surface's version counter advances when a designer merely clicks a question.
    // Staleness is compared as definitions, so this is not a change to follow or announce.
    expect(preview.isStale).toBe(false);
  });
});

describe('parity/M3-preview-data', () => {
  test('seeded answers are the premise of the run, not the first thing answered', () => {
    const designed = surface();

    const preview = session(designed, { data: { who: 'ada' } });

    expect(preview.data['who']).toBe('ada');
    // Armed after seeding, or a session with test data could never follow an edit.
    expect(preview.isTouched).toBe(false);
    expect(preview.survey.getQuestionByName('why')?.isVisible).toBe(true);
  });

  test('setting test data starts the run again', () => {
    const designed = surface();
    const preview = session(designed);
    preview.survey.setValue('who', 'nobody');
    const started = preview.run;

    preview.setTestData({ who: 'ada' });

    expect(preview.run).toBeGreaterThan(started);
    expect(preview.testData).toEqual({ who: 'ada' });
    expect(preview.data['who']).toBe('ada');
    expect(preview.isTouched).toBe(false);
  });

  test('the seed survives a restart, because it is the premise', () => {
    const designed = surface();
    const preview = session(designed, { data: { who: 'ada' } });

    preview.restart();

    expect(preview.data['who']).toBe('ada');
  });
});

describe('parity/M3-preview-devices', () => {
  test('it opens responsive, which is what the designer is already looking at', () => {
    const preview = session(surface());

    // A preview that opened at 375 would make every survey look like it had a mobile
    // problem it does not have.
    expect(preview.device.name).toBe('responsive');
    expect(preview.viewport).toEqual({ width: undefined, height: undefined });
  });

  test('a preset is a real size in the units width and minWidth are authored in', () => {
    const preview = session(surface());

    preview.setDevice('phone');

    expect(preview.viewport).toEqual({ width: 375, height: 667 });
  });

  test('rotating swaps the two numbers, and nothing else', () => {
    const preview = session(surface());
    preview.setDevice('tablet');

    preview.setOrientation('landscape');

    expect(preview.viewport).toEqual({ width: 1024, height: 768 });
  });

  test('changing the device never restarts the run', () => {
    const designed = surface();
    const preview = session(designed);
    preview.survey.setValue('who', 'ada');
    const started = preview.run;

    preview.setDevice('phone');
    preview.setOrientation('landscape');

    // Throwing away a half-filled run to look at it on a phone would make the one
    // question the preset exists to answer the hardest one to ask.
    expect(preview.run).toBe(started);
    expect(preview.data['who']).toBe('ada');
  });

  test('the desktop rotates too', () => {
    // A portrait monitor is a real thing people fill in forms on, and there is nothing to
    // gain by having the tool disbelieve in it.
    expect(previewViewport(previewDevice('desktop'), 'landscape')).toEqual({
      width: 800,
      height: 1280,
    });
  });

  test('a device nothing answers to falls back rather than measuring nothing', () => {
    expect(previewDevice('watch').name).toBe('responsive');
    expect(PREVIEW_DEVICES[0]?.name).toBe('responsive');
  });
});
