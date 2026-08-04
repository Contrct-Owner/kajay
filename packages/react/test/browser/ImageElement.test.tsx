/// <reference types="@vitest/browser/matchers" />
import { parseSurvey } from '@kajay/core';
import { Survey } from '@kajay/react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

test('image elements without authored media omit the src attribute', async () => {
  const model = parseSurvey({
    pages: [
      {
        name: 'p1',
        elements: [
          { type: 'image', name: 'empty-image' },
          { type: 'image', name: 'empty-video', contentMode: 'video' },
        ],
      },
    ],
  }).survey;

  const screen = await render(<Survey model={model} />);
  const image = screen.container.querySelector('[data-element-name="empty-image"]');
  const video = screen.container.querySelector('[data-element-name="empty-video"]');

  expect(image?.tagName).toBe('IMG');
  expect(image).not.toHaveAttribute('src');
  expect(video?.tagName).toBe('VIDEO');
  expect(video).not.toHaveAttribute('src');
});
