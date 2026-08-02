import { Panel, parseSurvey, serializeSurvey } from '@kajay/core';
import type { Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

function build(definition: Readonly<Record<string, unknown>>): Survey {
  return parseSurvey(definition, createTestRegistry()).survey;
}

function panelOf(survey: Survey, name: string): Panel {
  const found = survey.pages
    .flatMap((page) => page.elements)
    .find((element) => element.name === name);
  if (!(found instanceof Panel)) {
    throw new TypeError(`no panel named ${name}`);
  }
  return found;
}

const nested = {
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'text', name: 'outside' },
        {
          type: 'panel',
          name: 'contact',
          title: 'Contact details',
          elements: [
            { type: 'text', name: 'email' },
            {
              type: 'panel',
              name: 'address',
              title: 'Address',
              elements: [{ type: 'text', name: 'street' }],
            },
          ],
        },
      ],
    },
  ],
};

describe('parity/E1-panels', () => {
  test('a panel groups elements without holding an answer of its own', () => {
    const survey = build(nested);
    const panel = panelOf(survey, 'contact');

    expect(panel.elements.map((element) => element.name)).toEqual(['email', 'address']);
    survey.setValue('email', 'ada@example.com');
    // The panel contributes nothing to the result: it is structure, not an answer.
    expect(survey.data).toEqual({ email: 'ada@example.com' });
  });

  test('questions nest arbitrarily deep and are still found by name', () => {
    const survey = build(nested);

    expect(survey.questions.map((question) => question.name)).toEqual([
      'outside',
      'email',
      'street',
    ]);
    expect(survey.getQuestionByName('street')?.type).toBe('text');
  });

  test('a question inside a panel writes to the survey like any other', () => {
    const survey = build(nested);
    survey.getQuestionByName('street')?.attachValueHost(survey);
    survey.setValue('street', '5 Ada Way');
    expect(survey.getQuestionByName('street')?.value).toBe('5 Ada Way');
  });

  test('elements keep their authored order, panels included', () => {
    const survey = build(nested);
    const [page] = survey.pages;
    expect(page?.elements.map((element) => element.type)).toEqual(['text', 'panel']);
  });

  test('a page refuses a page as a child: it contains elements, it is not one', () => {
    const survey = build(nested);
    const [page, other] = [survey.pages[0], survey.pages[0]];
    expect(() => page?.addChild('elements', other as never)).toThrow(
      /accepts questions and panels/u,
    );
  });

  test('parity/E1-panels: panels round-trip, nesting and all', () => {
    const registry = createTestRegistry();
    const first = parseSurvey(nested, registry).survey;
    const canonical = serializeSurvey(first, registry);
    const second = serializeSurvey(parseSurvey(canonical, registry).survey, registry);

    expect(JSON.stringify(second)).toBe(JSON.stringify(canonical));
    expect(JSON.stringify(canonical)).toContain('"type":"panel"');
    expect(JSON.stringify(canonical)).toContain('"street"');
  });
});

describe('parity/E1-panel-visibility', () => {
  const conditional = {
    pages: [
      {
        name: 'p1',
        elements: [
          { type: 'text', name: 'gate' },
          {
            type: 'panel',
            name: 'extras',
            visibleIf: '{gate} notempty',
            elements: [{ type: 'text', name: 'inside' }],
          },
        ],
      },
    ],
  };

  test('visibleIf on a panel governs the whole group', () => {
    const survey = build(conditional);
    const [page] = survey.pages;

    expect(page?.visibleElements.map((element) => element.name)).toEqual(['gate']);
    survey.setValue('gate', 'yes');
    expect(page?.visibleElements.map((element) => element.name)).toEqual(['gate', 'extras']);
  });

  test('a hidden panel takes its questions out of reach without hiding them one by one', () => {
    const survey = build(conditional);

    // The question's own visibility is untouched — nothing set a rule on it. What
    // changed is reachability, which is what the renderer and navigation care about.
    expect(survey.getQuestionByName('inside')?.isVisible).toBe(true);
    expect(survey.visiblePages[0]?.visibleElements.map((element) => element.name)).toEqual([
      'gate',
    ]);
  });
});

describe('parity/E1-panel-collapse', () => {
  function collapsible(state: string): Survey {
    return build({
      pages: [
        {
          name: 'p1',
          elements: [
            { type: 'panel', name: 'section', title: 'Section', state, elements: [] },
          ],
        },
      ],
    });
  }

  test('an authored collapsed state starts collapsed', () => {
    expect(panelOf(collapsible('collapsed'), 'section').isCollapsed).toBe(true);
  });

  test('expanded and default both start open', () => {
    expect(panelOf(collapsible('expanded'), 'section').isCollapsed).toBe(false);
    expect(panelOf(collapsible('default'), 'section').isCollapsed).toBe(false);
  });

  test('toggling reports through the element-state channel', () => {
    const survey = collapsible('expanded');
    const panel = panelOf(survey, 'section');
    const seen: boolean[] = [];
    survey.onElementStateChanged.add((event) => {
      if (event.state === 'collapsed') {
        seen.push(event.value);
      }
    });

    panel.setCollapsed(true);
    panel.setCollapsed(true);
    panel.setCollapsed(false);

    // The repeat is silent: only real changes are announced.
    expect(seen).toEqual([true, false]);
  });

  test('collapsing does not hide the elements from the model', () => {
    const survey = build({
      pages: [
        {
          name: 'p1',
          elements: [
            {
              type: 'panel',
              name: 'section',
              state: 'collapsed',
              elements: [{ type: 'text', name: 'hidden-away' }],
            },
          ],
        },
      ],
    });

    // Collapsed is a rendering state, not a visibility one. A collapsed panel that
    // dropped its questions would be indistinguishable from a hidden one.
    expect(panelOf(survey, 'section').visibleElements).toHaveLength(1);
    expect(survey.getQuestionByName('hidden-away')).toBeDefined();
  });
});
