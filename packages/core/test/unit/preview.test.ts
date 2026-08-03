import { parseSurvey } from '@kajay/core';
import type { Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

function build(extra: Readonly<Record<string, unknown>> = {}): Survey {
  return parseSurvey(
    {
      showPreviewBeforeComplete: 'showAllQuestions',
      ...extra,
      pages: [
        { name: 'p1', elements: [{ type: 'text', name: 'name' }] },
        {
          name: 'p2',
          elements: [
            { type: 'text', name: 'nickname' },
            { type: 'text', name: 'notes' },
          ],
        },
      ],
    },
    createTestRegistry(),
  ).survey;
}

/** Answers the first page and walks to the end of the survey. */
function atTheEnd(extra: Readonly<Record<string, unknown>> = {}): Survey {
  const survey = build(extra);
  survey.setValue('name', 'Ada');
  survey.nextPageOrComplete();
  survey.setValue('nickname', 'Ada');
  return survey;
}

describe('parity/E4-preview', () => {
  test('without one, the last page completes as it always did', () => {
    const survey = atTheEnd({ showPreviewBeforeComplete: 'noPreview' });
    expect(survey.nextPageOrComplete()).toBe('advanced');
    expect(survey.status.state).toBe('completed');
  });

  test('the end of the last page is a preview, not the end', () => {
    const survey = atTheEnd();
    survey.nextPageOrComplete();

    expect(survey.status.state).toBe('preview');
    // Not completed: nothing has been submitted, which is the whole point of showing it.
    expect(survey.isCompleted).toBe(false);
  });

  test('a preview cannot be answered, without any renderer being told', () => {
    const survey = atTheEnd();
    survey.nextPageOrComplete();

    // Read-only is a fact about the survey while previewing, so every question already
    // reports it. A preview a respondent could type into is not a preview.
    expect(survey.isReadOnly).toBe(true);
    expect(survey.getQuestionByName('name')?.isReadOnly).toBe(true);
  });

  test('completing from the preview ends the survey', () => {
    const survey = atTheEnd();
    survey.nextPageOrComplete();
    expect(survey.nextPageOrComplete()).toBe('advanced');

    expect(survey.status.state).toBe('completed');
    // And answering is over for good, rather than the read-only flag lingering.
    expect(survey.isReadOnly).toBe(false);
  });

  test('editing goes back to the page they left, answerable again', () => {
    const survey = atTheEnd();
    survey.nextPageOrComplete();
    survey.status.cancelPreview();

    expect(survey.status.state).toBe('running');
    expect(survey.currentPage?.name).toBe('p2');
    // A preview that costs a respondent their place is one they learn not to open.
    expect(survey.isReadOnly).toBe(false);
  });

  test('the gate runs before the preview, not after it', () => {
    const survey = build({ showPreviewBeforeComplete: 'showAllQuestions' });
    survey.setValue('name', 'Ada');
    survey.nextPageOrComplete();
    survey.getQuestionByName('notes')?.setPropertyValue('isRequired', true);

    expect(survey.nextPageOrComplete()).toBe('blocked');
    // Reviewing answers the survey is about to refuse would be a wasted screen.
    expect(survey.status.state).toBe('running');
  });

  test('every reachable question is shown, answered or not', () => {
    const survey = atTheEnd();
    expect(survey.previewQuestions.map((question) => question.name)).toEqual([
      'name',
      'nickname',
      'notes',
    ]);
  });

  test('showAnsweredQuestions shows only what they said', () => {
    const survey = atTheEnd({ showPreviewBeforeComplete: 'showAnsweredQuestions' });
    // Forty untouched optional questions bury the eight that matter.
    expect(survey.previewQuestions.map((question) => question.name)).toEqual([
      'name',
      'nickname',
    ]);
  });

  test('a question on a page conditioned away was never asked, so it is not reviewed', () => {
    const survey = parseSurvey(
      {
        showPreviewBeforeComplete: 'showAllQuestions',
        clearInvisibleValues: 'none',
        pages: [
          { name: 'p1', elements: [{ type: 'text', name: 'plan' }] },
          {
            name: 'p2',
            visibleIf: '{plan} = "paid"',
            elements: [{ type: 'text', name: 'card' }],
          },
        ],
      },
      createTestRegistry(),
    ).survey;
    survey.setValue('plan', 'free');

    expect(survey.previewQuestions.map((question) => question.name)).toEqual(['plan']);
  });

  test('an unknown mode means no preview rather than an unexpected one', () => {
    const survey = atTheEnd({ showPreviewBeforeComplete: 'sometimes' });
    expect(survey.showPreviewBeforeComplete).toBe('noPreview');
    survey.nextPageOrComplete();
    expect(survey.status.state).toBe('completed');
  });

  test('the state change is announced, both entering and leaving', () => {
    const survey = atTheEnd();
    const seen: string[] = [];
    survey.onStateChanged.add((event) => seen.push(event.state));

    survey.nextPageOrComplete();
    survey.status.cancelPreview();
    survey.nextPageOrComplete();

    expect(seen).toEqual(['preview', 'running', 'preview']);
  });
});
