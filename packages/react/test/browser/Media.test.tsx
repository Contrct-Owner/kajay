/// <reference types="@vitest/browser/matchers" />
import { parseSurvey } from '@kajay/core';
import type { Survey as SurveyModel } from '@kajay/core';
import { Survey } from '@kajay/react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/**
 * Files and signatures in a real DOM — checklist H1, H2 and H3.
 *
 * The model's own tests prove what an answer becomes once an adapter has read a file.
 * What only a browser shows is the reading itself: that a picked file reaches the model
 * with its content, that a dropped one does too, and that a stroke on a canvas becomes
 * a data URL.
 */
function build(overrides: Readonly<Record<string, unknown>> = {}): SurveyModel {
  return parseSurvey({
    pages: [
      {
        name: 'p1',
        elements: [
          {
            type: 'file',
            name: 'receipt',
            title: 'Your receipt',
            storeDataAsText: true,
            ...overrides,
          },
        ],
      },
    ],
  }).survey;
}

function textFile(name: string, type = 'text/plain'): File {
  return new File(['hello'], name, { type });
}

/** Waits for the model to catch up: reading a file is asynchronous by nature. */
async function settled(check: () => boolean): Promise<void> {
  await expect.poll(check, { timeout: 2000 }).toBe(true);
}

test('parity/H1-file: a picked file reaches the model with its content', async () => {
  const model = build();
  const screen = await render(<Survey model={model} />);

  const input = screen.getByLabelText('Your receipt');
  await input.element().dispatchEvent(new Event('focus'));
  const element = input.element() as HTMLInputElement;
  const transfer = new DataTransfer();
  transfer.items.add(textFile('receipt.txt'));
  element.files = transfer.files;
  element.dispatchEvent(new Event('change', { bubbles: true }));

  await settled(() => model.data['receipt'] !== undefined);
  expect(model.data).toEqual({
    receipt: [
      {
        name: 'receipt.txt',
        type: 'text/plain',
        size: 5,
        // Read by the adapter, because core is DOM-free and a FileReader is not.
        content: expect.stringContaining('data:text/plain'),
      },
    ],
  });
});

test('parity/H1-file: a dropped file is attached like a picked one', async () => {
  const model = build();
  const screen = await render(<Survey model={model} />);

  const zone = screen.container.querySelector('.kajay-file__drop');
  const transfer = new DataTransfer();
  transfer.items.add(textFile('dropped.txt'));
  zone?.dispatchEvent(
    Object.assign(new Event('drop', { bubbles: true }), { dataTransfer: transfer }),
  );

  await settled(() => model.data['receipt'] !== undefined);
  expect((model.data['receipt'] as readonly { name: string }[])[0]?.name).toBe('dropped.txt');
});

test('parity/H1-file: what was attached is listed, and can be taken back off', async () => {
  const model = build();
  const screen = await render(<Survey model={model} />);

  const element = screen.getByLabelText('Your receipt').element() as HTMLInputElement;
  const transfer = new DataTransfer();
  transfer.items.add(textFile('receipt.txt'));
  element.files = transfer.files;
  element.dispatchEvent(new Event('change', { bubbles: true }));
  await settled(() => model.data['receipt'] !== undefined);

  // Scoped to the list: the remove button names the file too, which is the point.
  await expect
    .element(screen.container.querySelector('.kajay-file__name') as HTMLElement)
    .toHaveTextContent('receipt.txt');
  // Named for the file it removes: three buttons all reading "Remove" is a guess.
  await screen.getByRole('button', { name: 'Remove receipt.txt' }).click();

  expect(model.data).toEqual({});
});

test('parity/H1-file: the accepted types reach the picker as an affordance too', async () => {
  const screen = await render(<Survey model={build({ acceptedTypes: 'image/*,.pdf' })} />);

  // The rule is enforced in the model; this is the picker being told what to offer, the
  // same pairing as a text question's `min`.
  await expect
    .element(screen.getByLabelText('Your receipt'))
    .toHaveAttribute('accept', 'image/*,.pdf');
});

test('parity/H2-signature: a stroke becomes a data URL', async () => {
  const model = parseSurvey({
    pages: [
      {
        name: 'p1',
        elements: [{ type: 'signaturepad', name: 'sign', title: 'Sign here' }],
      },
    ],
  }).survey;
  const screen = await render(<Survey model={model} />);

  const canvas = screen.container.querySelector('canvas');
  if (canvas === null) {
    throw new Error('expected a canvas');
  }
  const pointer = { bubbles: true, pointerId: 1, clientX: 10, clientY: 10 };
  canvas.dispatchEvent(new PointerEvent('pointerdown', pointer));
  canvas.dispatchEvent(new PointerEvent('pointermove', { ...pointer, clientX: 60, clientY: 40 }));
  canvas.dispatchEvent(new PointerEvent('pointerup', pointer));

  expect(String(model.data['sign'])).toContain('data:image/png');
});

test('parity/H2-signature: the pad says whether it has been signed', async () => {
  const model = parseSurvey({
    pages: [
      {
        name: 'p1',
        elements: [{ type: 'signaturepad', name: 'sign', title: 'Sign here' }],
      },
    ],
  }).survey;
  const screen = await render(<Survey model={model} />);

  // The canvas cannot be operated by keyboard — §J4 owns that — so the least it can do
  // is announce what state it is in rather than being an unlabelled box.
  await expect
    .element(screen.getByRole('img', { name: 'Sign here: not yet signed' }))
    .toBeInTheDocument();

  model.setValue('sign', 'data:image/png;base64,AAAA');
  await expect
    .element(screen.getByRole('img', { name: 'Sign here: signed' }))
    .toBeInTheDocument();
});

test('parity/H2-signature: a re-render does not wipe the pad', async () => {
  // One red pixel, which is enough to tell an inked canvas from a blank one.
  const dot =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const model = parseSurvey({
    pages: [
      {
        name: 'p1',
        elements: [
          { type: 'text', name: 'other', title: 'Anything' },
          { type: 'signaturepad', name: 'sign', title: 'Sign here' },
        ],
      },
    ],
  }).survey;
  model.setValue('sign', dot);
  const screen = await render(<Survey model={model} />);

  const canvas = screen.container.querySelector('canvas');
  if (canvas === null) {
    throw new Error('expected a canvas');
  }
  const blank = document.createElement('canvas');
  blank.width = canvas.width;
  blank.height = canvas.height;
  const blankData = blank.toDataURL('image/png');

  // Answering something else re-renders the page. The answer is the truth about what
  // was signed and the canvas is only a view of it — one React hands back empty. Without
  // painting it back, the next stroke would save a signature missing everything drawn
  // before the re-render.
  model.setValue('other', 'anything at all');
  await expect.poll(() => canvas.toDataURL('image/png') !== blankData).toBe(true);
});

test('parity/H2-signature: clearing erases the answer', async () => {
  const model = parseSurvey({
    pages: [
      {
        name: 'p1',
        elements: [{ type: 'signaturepad', name: 'sign', title: 'Sign here' }],
      },
    ],
  }).survey;
  model.setValue('sign', 'data:image/png;base64,AAAA');
  const screen = await render(<Survey model={model} />);

  await screen.getByRole('button', { name: 'Clear signature' }).click();

  expect(model.data).toEqual({});
});
