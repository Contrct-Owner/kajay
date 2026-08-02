/// <reference types="@vitest/browser/matchers" />
import { parseSurvey } from '@kajay/core';
import { Survey } from '@kajay/react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

test('parity/C6-tagbox: the adapter preserves core selection invariants', async () => {
  const model = parseSurvey({
    pages: [
      {
        name: 'p1',
        elements: [
          {
            type: 'tagbox',
            name: 'langs',
            title: 'Languages',
            choices: ['ts', 'go'],
            maxSelectedChoices: 1,
            showNoneItem: true,
          },
        ],
      },
    ],
  }).survey;

  const screen = await render(<Survey model={model} />);
  const input = screen.getByLabelText('Languages');

  await input.selectOptions(['ts', 'go']);
  expect(model.data).toEqual({ langs: ['ts'] });

  await input.selectOptions('none');
  expect(model.data).toEqual({ langs: ['none'] });
});
