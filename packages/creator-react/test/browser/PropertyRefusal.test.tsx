/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { CreatorStringDictionary, DesignSurface } from '@kajay/creator-core';
import { CreatorStringsProvider, PropertyGridPanel } from '@kajay/creator-react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

/** A refused edit says why, on the field — checklist P5, ADR-0023. */
const BASIC: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'text', name: 'who', title: 'Your name' },
        { type: 'text', name: 'where', title: 'Where' },
      ],
    },
  ],
};

function surfaceWith(definition: SurveyDefinition = BASIC): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  const designed = new DesignSurface({ definition, registry });
  designed.select(designed.survey.getQuestionByName('who')!);
  return designed;
}

test('parity/P5-refusal-shown: renaming to a taken name says which name, and reverts', async () => {
  const surface = surfaceWith();
  const screen = await render(<PropertyGridPanel surface={surface} />);

  const name = screen.getByTestId('property-who-name');
  await userEvent.fill(name, 'where');
  // Commits on blur, which is where the refusal happens — and where, before this row, the
  // field silently put the old name back and said nothing at all.
  await userEvent.tab();

  await expect
    .element(screen.getByTestId('property-who-name-refusal'))
    .toHaveTextContent('“where” is already used.');
  // The document is unchanged and the field shows what the document says.
  await expect.element(screen.getByTestId('property-who-name')).toHaveValue('who');
  expect(surface.survey.getQuestionByName('who')).toBeDefined();
});

test('parity/P5-refusal-shown: the reason is announced and tied to the field', async () => {
  const surface = surfaceWith();
  const screen = await render(<PropertyGridPanel surface={surface} />);

  await userEvent.fill(screen.getByTestId('property-who-name'), '   ');
  await userEvent.tab();

  const note = screen.getByTestId('property-who-name-refusal');
  // `role="alert"` because a blur-committed refusal lands after focus has left: nothing
  // re-reads the field's description, so the description wiring alone would be silent for
  // a screen-reader user — the same nothing a sighted one used to get.
  await expect.element(note).toHaveAttribute('role', 'alert');

  const field = screen.getByTestId('property-who-name');
  await expect.element(field).toHaveAttribute('aria-invalid', 'true');
  const describedBy = (await field.element()).getAttribute('aria-describedby') ?? '';
  expect(describedBy.split(' ')).toContain((await note.element()).id);
});

test('parity/P5-refusal-shown: typing again clears the reason', async () => {
  const surface = surfaceWith();
  const screen = await render(<PropertyGridPanel surface={surface} />);

  await userEvent.fill(screen.getByTestId('property-who-name'), 'where');
  await userEvent.tab();
  await expect.element(screen.getByTestId('property-who-name-refusal')).toBeInTheDocument();

  await userEvent.fill(screen.getByTestId('property-who-name'), 'whom');

  // The message was about the name they had just tried. Leaving it up beside a field they
  // are now changing would attach it to something nothing has judged yet.
  await expect.element(screen.getByTestId('property-who-name-refusal')).not.toBeInTheDocument();
});

test('parity/P5-refusal-shown: an accepted rename says nothing', async () => {
  const surface = surfaceWith();
  const screen = await render(<PropertyGridPanel surface={surface} />);

  await userEvent.fill(screen.getByTestId('property-who-name'), 'applicant');
  await userEvent.tab();

  // Silence is right *here* — the edit took, and a note confirming every keystroke would
  // make the notes people learn to ignore.
  await expect.element(screen.getByTestId('property-who-name-refusal')).not.toBeInTheDocument();
  expect(surface.survey.getQuestionByName('applicant')).toBeDefined();
});

test('parity/P5-refusal-shown: the reason is the host’s word when they supply one', async () => {
  const strings = new CreatorStringDictionary();
  strings.register('en', { refusalNameTaken: 'Pick another — {0} is spoken for.' });
  const surface = surfaceWith();

  const screen = await render(
    <CreatorStringsProvider dictionary={strings}>
      <PropertyGridPanel surface={surface} />
    </CreatorStringsProvider>,
  );

  await userEvent.fill(screen.getByTestId('property-who-name'), 'where');
  await userEvent.tab();

  // N3 covers these like every other string, which is the reason the message key lives in
  // the catalogue rather than being assembled at the call site.
  await expect
    .element(screen.getByTestId('property-who-name-refusal'))
    .toHaveTextContent('Pick another — where is spoken for.');
});

test('parity/P5-refusal-shown: a read-only deployment says so rather than going quiet', async () => {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  const surface = new DesignSurface({
    definition: BASIC,
    registry,
    configuration: { isReadOnly: true },
  });
  surface.select(surface.survey.getQuestionByName('who')!);

  const screen = await render(<PropertyGridPanel surface={surface} />);

  await userEvent.fill(screen.getByTestId('property-who-title'), 'Nope');
  await userEvent.tab();

  // N2 refuses at the chokepoint and used to do it in silence. The grid never learns what
  // read-only is — the refusal is minted by `change` and carried out.
  await expect
    .element(screen.getByTestId('property-who-title-refusal'))
    .toHaveTextContent('open for reading only');
});
