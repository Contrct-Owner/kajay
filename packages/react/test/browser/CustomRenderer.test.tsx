/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, Question, parseSurvey, registerBuiltInTypes } from '@kajay/core';
import {
  Survey,
  defaultPageElementRenderers,
} from '@kajay/react';
import type {
  PageElementRendererRegistry,
  PageElementRendererResolver,
  SurveyProps,
} from '@kajay/react';
import { expect, expectTypeOf, test } from 'vitest';
import { render } from 'vitest-browser-react';

class CustomNoteQuestion extends Question {
  override get type(): string {
    return 'custom-note';
  }
}

test('parity/A4-custom-question-renderer: a registered type renders through the page-element registry', async () => {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  registry.addClass({
    name: 'custom-note',
    parent: 'question',
    create: () => new CustomNoteQuestion(),
  });
  const model = parseSurvey(
    {
      pages: [
        {
          name: 'p1',
          elements: [{ type: 'custom-note', name: 'note', title: 'Custom note' }],
        },
      ],
    },
    registry,
  ).survey;
  const renderers = defaultPageElementRenderers.clone();
  renderers.registerQuestion('custom-note', ({ question }) => (
    <button
      type="button"
      onClick={() => {
        question.value = 'acknowledged';
      }}
    >
      {question.title}
    </button>
  ));

  const screen = await render(<Survey model={model} renderers={renderers} />);
  const custom = screen.getByRole('button', { name: 'Custom note' });
  await expect.element(custom).toBeVisible();
  await custom.click();
  expect(model.data).toEqual({ note: 'acknowledged' });
});

test('a delegating resolver handles custom questions nested inside built-in panels', async () => {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  registry.addClass({
    name: 'custom-note',
    parent: 'question',
    create: () => new CustomNoteQuestion(),
  });
  const model = parseSurvey(
    {
      pages: [
        {
          name: 'p1',
          elements: [
            {
              type: 'panel',
              name: 'group',
              elements: [{ type: 'custom-note', name: 'note', title: 'Nested custom note' }],
            },
          ],
        },
      ],
    },
    registry,
  ).survey;
  const renderers: PageElementRendererResolver = {
    render(survey, element) {
      if (element instanceof CustomNoteQuestion) {
        return <p>{element.title}</p>;
      }
      return defaultPageElementRenderers.render(survey, element);
    },
  };

  const screen = await render(<Survey model={model} renderers={renderers} />);

  await expect.element(screen.getByText('Nested custom note')).toBeVisible();
  await expect
    .element(screen.getByText(/No renderer is registered for page element "custom-note"/u))
    .not.toBeInTheDocument();
});

test('the shared defaults are immutable and custom renderer clones are isolated', () => {
  expectTypeOf(defaultPageElementRenderers).not.toHaveProperty('register');
  expectTypeOf(defaultPageElementRenderers).not.toHaveProperty('registerQuestion');
  expectTypeOf(defaultPageElementRenderers.clone()).toEqualTypeOf<PageElementRendererRegistry>();
  expectTypeOf(defaultPageElementRenderers).toExtend<
    NonNullable<SurveyProps['renderers']>
  >();
  expectTypeOf<PageElementRendererRegistry>().toExtend<PageElementRendererResolver>();

  expect(() => {
    // The cast proves the runtime guard remains defense in depth for untyped JavaScript
    // consumers; ordinary TypeScript consumers cannot call this method on the default.
    (defaultPageElementRenderers as PageElementRendererRegistry).register(
      'host-only',
      () => <div>Host only</div>,
    );
  }).toThrow(/frozen.*clone/u);

  const firstSurveyRenderers = defaultPageElementRenderers.clone();
  const secondSurveyRenderers = defaultPageElementRenderers.clone();
  firstSurveyRenderers.register('host-only', () => <div>Host only</div>);

  expect(firstSurveyRenderers.has('host-only')).toBe(true);
  expect(secondSurveyRenderers.has('host-only')).toBe(false);
  expect(defaultPageElementRenderers.has('host-only')).toBe(false);
});
