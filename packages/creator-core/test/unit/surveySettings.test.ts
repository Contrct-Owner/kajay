import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface } from '@kajay/creator-core';
import { describe, expect, test } from 'vitest';

/** Survey-level and page-level settings — checklist L5. */
const BASIC: SurveyDefinition = {
  title: 'A survey',
  calculatedValues: [{ name: 'total', expression: '1 + 1' }],
  pages: [
    { name: 'p1', title: 'First', elements: [{ type: 'text', name: 'who' }] },
    { name: 'p2', elements: [] },
  ],
};

function surface(definition: SurveyDefinition = BASIC): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return new DesignSurface({ definition, registry });
}

function names(designed: DesignSurface): readonly string[] {
  const element = designed.selected;
  if (element === undefined) {
    throw new Error('Nothing selected.');
  }
  return designed.properties(element).flatMap((category) => category.rows.map((row) => row.name));
}

function collections(designed: DesignSurface): readonly string[] {
  const element = designed.selected;
  if (element === undefined) {
    throw new Error('Nothing selected.');
  }
  return designed.collections(element).map((row) => row.property);
}

describe('parity/L5-survey-settings', () => {
  test('the survey is selectable, and its grid is generated like any other', () => {
    const designed = surface();

    designed.selectSurvey();

    // `survey` is a registered class, so this row needed no property-grid code at all —
    // the same way K4's selectable page needed none.
    expect(designed.selected).toBe(designed.survey);
    expect(names(designed)).toContain('showProgressBar');
    expect(names(designed)).toContain('clearInvisibleValues');
    expect(names(designed)).toContain('completedHtml');
  });

  test('the survey has no name, and that is not a gap', () => {
    const designed = surface();

    designed.select(designed.survey.getQuestionByName('who')!);
    designed.selectSurvey();

    // It is the thing names are unique within. Inventing a reserved one would put a token
    // into a channel that otherwise holds real names — and leaving the *previous*
    // selection's name behind would make the next structural edit hand it back, putting
    // the grid on a question while the survey is what is on screen.
    expect(designed.selection.name).toBeUndefined();
    expect(designed.selection.isSurvey).toBe(true);
  });

  test('an edit that names something takes the selection off the survey', () => {
    const designed = surface();
    designed.selectSurvey();

    designed.duplicate('who');

    // An edit that names nothing leaves the selection alone — which for the survey is the
    // only way it can survive. One that names something means it.
    expect(designed.selection.isSurvey).toBe(false);
    expect(designed.selection.name).toBe('who2');
  });

  test('an undo puts the designer back on the survey when that is where they were', () => {
    const designed = surface();
    designed.selectSurvey();
    designed.addChild(designed.survey, 'calculatedValues', 'calculatedvalue');
    designed.select(designed.survey.getQuestionByName('who')!);

    designed.undo();

    // The snapshot taken before that edit had the survey selected, and the survey has no
    // name for `selected` to have held it in.
    expect(designed.selection.isSurvey).toBe(true);
    expect(designed.selected).toBe(designed.survey);
  });

  test('its properties are edited through the same chokepoint', () => {
    const designed = surface();
    designed.selectSurvey();

    designed.setProperty(designed.survey, 'showProgressBar', 'top');

    expect(designed.definition['showProgressBar']).toBe('top');
    designed.undo();
    expect(designed.definition['showProgressBar']).toBeUndefined();
  });

  test('what it contains arrives as collection editors, with no code about any of it', () => {
    const designed = surface();
    designed.selectSurvey();

    // Calculated values, triggers and conditional endings, for the same reason a
    // question's choices do.
    expect(collections(designed)).toEqual([
      'calculatedValues',
      'triggers',
      'completedHtmlOnCondition',
    ]);
  });

  test('`pages` is not among them, because the navigator owns it', () => {
    const designed = surface();
    designed.selectSurvey();

    // K4 built selecting, reordering and deleting for exactly that collection, and a
    // second way to reorder it here would be a second place for the two to disagree.
    expect(collections(designed)).not.toContain('pages');
  });

  test('a calculated value is added and edited like any other child', () => {
    const designed = surface();
    designed.selectSurvey();

    designed.addChild(designed.survey, 'calculatedValues', 'calculatedvalue');

    expect(designed.survey.calculatedValues).toHaveLength(2);
    expect(designed.survey.calculatedValues[1]?.name).toBe('calculatedvalue1');
  });

  test('selecting an element takes the selection off the survey, and back', () => {
    const designed = surface();
    const who = designed.survey.getQuestionByName('who');

    designed.selectSurvey();
    designed.select(who!);
    expect(designed.selection.isSurvey).toBe(false);
    expect(designed.selection.name).toBe('who');

    designed.selectSurvey();
    expect(designed.selected).toBe(designed.survey);

    designed.clearSelection();
    expect(designed.selected).toBeUndefined();
  });

  test('the survey survives the re-parse a structural edit causes', () => {
    const designed = surface();
    designed.selectSurvey();

    designed.addPage();

    // Nothing to resolve: the survey is always there, so "the survey is selected" cannot
    // go stale — which is the whole reason it is a flag rather than a name.
    expect(designed.selected).toBe(designed.survey);
  });

  test('an undo puts the designer back where the change was made', () => {
    const designed = surface();
    const who = designed.survey.getQuestionByName('who');
    designed.select(who!);
    designed.setProperty(who!, 'title', 'Renamed');

    designed.selectSurvey();
    designed.undo();

    // Recorded separately because the survey has no name for the snapshot to hold.
    // Without it, undoing while looking at the survey would leave the grid there while
    // restoring a question nobody could see change.
    expect(designed.selection.isSurvey).toBe(false);
    expect(designed.selection.name).toBe('who');
  });
});

describe('parity/L5-page-settings', () => {
  test('a page’s own settings are its grid, reached by selecting it', () => {
    const designed = surface();

    designed.select(designed.pages[0]!);

    expect(names(designed)).toEqual(['name', 'title', 'maxTimeToFinish', 'visibleIf', 'colCount']);
  });

  test('a page holds no collection the grid should draw', () => {
    const designed = surface();
    designed.select(designed.pages[0]!);

    // `elements` is the canvas's.
    expect(collections(designed)).toEqual([]);
  });

  test('switching page clears the selection rather than leaving it off screen', () => {
    const designed = surface();
    designed.select(designed.survey.getQuestionByName('who')!);

    designed.goToPage('p2');

    expect(designed.selected).toBeUndefined();
  });
});
