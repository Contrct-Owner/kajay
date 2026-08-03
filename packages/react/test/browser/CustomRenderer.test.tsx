/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, Question, parseSurvey, registerBuiltInTypes } from '@kajay/core';
import { Survey, defaultPageElementRenderers } from '@kajay/react';
import { expect, test } from 'vitest';
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
