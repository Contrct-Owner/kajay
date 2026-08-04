import {
  MatrixDynamicQuestion,
  MatrixQuestion,
  PanelDynamicQuestion,
  parseSurvey,
  SelectQuestion,
  serializeSurvey,
} from '@kajay/core';
import type { PageElement, Survey, SurveyDefinition } from '@kajay/core';
import { DesignSurface, Toolbox } from '@kajay/creator-core';
import { describe, expect, test } from 'vitest';
import {
  ANSWERS,
  COMPUTED,
  buildEveryType,
  registryWithBuiltIns,
} from '../support/everyTypeSurvey.js';

/**
 * The overall acceptance scenario — checklist N5.
 *
 * Build a survey covering every type the toolbox offers, **through the Creator**; render
 * it; answer it; and bring the definition back into the Creator unchanged. This file owns
 * the two halves a headless test can make honestly — that every type survives the round
 * trip, and that every question can actually be answered. What it cannot say is whether
 * any of it *draws*, which is why there is a browser leg beside it.
 */
describe('parity/N5-every-type', () => {
  test('every type the toolbox offers can be placed', () => {
    const registry = registryWithBuiltIns();
    const items = new Toolbox({ registry }).items;
    const surface = buildEveryType(registry);

    // Derived from the toolbox rather than counted against a number written here: a
    // twentieth type added tomorrow is covered by this scenario the day it is registered,
    // or it fails until somebody says why not.
    expect(surface.page?.elements.map((element) => element.type)).toEqual(
      items.map((item) => item.type),
    );
    // And the toolbox is checked against the *registry*, or this scenario would be
    // exhaustive only over whatever the toolbox happened to offer — a type registered and
    // never surfaced would be covered by both sides of the same omission.
    expect(items.map((item) => item.type).toSorted()).toEqual(
      registry.getConcreteSubclasses('pageelement').toSorted(),
    );
    // Placing is not the claim; placing something the parser accepts is. A refused drop
    // and a drop that produced a broken element look identical from the element count.
    expect(surface.diagnostics.filter((entry) => entry.severity === 'error')).toEqual([]);
  });

  test('a question arrives from the toolbox ready to be answered', () => {
    const registry = registryWithBuiltIns();
    const definition = buildEveryType(registry).definition;
    const { survey } = parseSurvey(definition, registry);

    // N5's finding, and the reason this row changed production code at all: until it was
    // walked, every drop produced an element with nothing in it. A dropdown with no
    // choices is a question a respondent can look at and cannot answer.
    expect(choicesOf(survey, 'dropdown1')).toHaveLength(3);
    expect(choicesOf(survey, 'ranking1')).toHaveLength(3);
    expect(asMatrix(survey, 'matrix1').rows).toHaveLength(2);
    expect(questionOf(survey, 'matrixdynamic1', MatrixDynamicQuestion).columns).toHaveLength(1);
    expect(questionOf(survey, 'paneldynamic1', PanelDynamicQuestion).templateElements)
      .toHaveLength(1);
    // And the line the starter content stops at: a display element's content is *entirely*
    // the designer's, and there is no placeholder for it that is not noise.
    expect(elementNamed(definition, 'html1')['html']).toBeUndefined();
    expect(elementNamed(definition, 'image1')['imageLink']).toBeUndefined();
  });

  test('what the Creator built is a round-trip fixed point', () => {
    const registry = registryWithBuiltIns();
    const built = buildEveryType(registry).definition;

    const once = serializeSurvey(parseSurvey(built, registry).survey);
    const twice = serializeSurvey(parseSurvey(once, registry).survey);

    // ADR-0002 over the widest definition this repository can produce. Every earlier row
    // proved it for its own type; this is the one that proves the types do not interfere.
    expect(once).toEqual(built);
    expect(twice).toEqual(once);
  });

  test('the definition comes back into the Creator unchanged', () => {
    const registry = registryWithBuiltIns();
    const built = buildEveryType(registry).definition;

    const reopened = new DesignSurface({ definition: built, registry });

    expect(reopened.definition).toEqual(built);
    // Unchanged JSON is not the same claim as a usable document: a re-opened survey whose
    // elements no longer generate a property grid would round-trip perfectly and be dead
    // on the canvas.
    for (const element of reopened.page?.elements ?? []) {
      reopened.select(element);
      expect((reopened.selected as PageElement | undefined)?.name).toBe(element.name);
      expect(reopened.properties(element).length).toBeGreaterThan(0);
    }
  });
});

describe('parity/N5-submit', () => {
  test('every question this survey holds has an answer written for it', () => {
    const registry = registryWithBuiltIns();
    const { survey } = parseSurvey(buildEveryType(registry).definition, registry);

    // The table below is unavoidable — only a person knows that a matrix wants a row and
    // a column — but its *completeness* is not left to one. A type nobody wrote an answer
    // for fails here rather than being quietly skipped in the loop that answers them.
    expect(survey.questions.map((question) => question.type).toSorted()).toEqual(
      [...Object.keys(ANSWERS), ...COMPUTED].toSorted(),
    );
  });

  test('the survey can be answered and submitted', () => {
    const registry = registryWithBuiltIns();
    const { survey } = parseSurvey(buildEveryType(registry).definition, registry);

    answerEverything(survey);
    // Through the ordinary gate rather than `complete()`, which would skip it: what this
    // has to prove is that a page holding one of every type *accepts* the answers, and a
    // validator that refused one of them would be invisible to a direct completion.
    expect(survey.nextPageOrComplete()).toBe('advanced');

    expect(survey.isCompleted).toBe(true);
    for (const question of survey.questions) {
      if (ANSWERS[question.type] !== undefined) {
        expect(survey.data[question.name]).toBeDefined();
      }
    }
  });

  test('the response survives being stored and restored', () => {
    const registry = registryWithBuiltIns();
    const definition = buildEveryType(registry).definition;
    const { survey } = parseSurvey(definition, registry);
    answerEverything(survey);
    const response = survey.data;

    const second = parseSurvey(definition, registry).survey;
    second.setData(response);

    // The half of "lossless" that is about the *response* rather than the definition: a
    // survey covering every type must be able to hand its answers to a store and get the
    // same answers back, or E6's save-and-resume is true only of the types it was tried on.
    expect(second.data).toEqual(response);
  });
});

function answerEverything(survey: Survey): void {
  for (const question of survey.questions) {
    const answer = ANSWERS[question.type];
    if (answer !== undefined) {
      survey.setValue(question.name, answer);
    }
  }
}

/**
 * The concrete question behind a name, or a failure that says which one was missing.
 *
 * `getQuestionByName` answers with the base class, which is right for it and useless
 * here: the properties this scenario asks about — rows, columns, a template — are the
 * things each type adds, and a cast without the check would turn a missing question into
 * an `undefined` two assertions later.
 */
function questionOf<T>(survey: Survey, name: string, kind: abstract new () => T): T {
  const found = survey.getQuestionByName(name);
  if (!(found instanceof kind)) {
    throw new Error(`"${name}" is not a ${kind.name}.`);
  }
  return found;
}

function asMatrix(survey: Survey, name: string): MatrixQuestion {
  return questionOf(survey, name, MatrixQuestion);
}

function choicesOf(survey: Survey, name: string): readonly unknown[] {
  return questionOf(survey, name, SelectQuestion).choices;
}

function elementNamed(definition: SurveyDefinition, name: string): Record<string, unknown> {
  const pages = definition['pages'] as readonly Record<string, unknown>[];
  const elements = pages[0]?.['elements'] as readonly Record<string, unknown>[];
  const found = elements.find((element) => element['name'] === name);
  if (found === undefined) {
    throw new Error(`No element called "${name}".`);
  }
  return found;
}
