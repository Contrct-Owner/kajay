/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface, Toolbox } from '@kajay/creator-core';
import { SurveyCreator } from '@kajay/creator-react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/**
 * The overall acceptance scenario, in a real browser — checklist N5.
 *
 * The claim this leg exists to make is the one a headless test cannot: that every type
 * **draws**. A renderer missing from the registry is invisible to the model — the survey
 * parses, the definition round-trips, the answers land — and a respondent sees a grey box
 * saying no renderer is registered.
 */
function registry(): MetadataRegistry {
  const made = new MetadataRegistry();
  registerBuiltInTypes(made);
  return made;
}

/**
 * One of everything, built by driving the Creator — the same eight lines as the headless
 * fixture, deliberately re-stated rather than shared: a test in this package reaching into
 * another package's test tree would be the one cross-package import the guidelines forbid,
 * and the list of types is the toolbox's either way.
 */
function everyType(made: MetadataRegistry): SurveyDefinition {
  const surface = new DesignSurface({
    definition: { title: 'One of everything', pages: [{ name: 'p1', title: 'Every type' }] },
    registry: made,
  });
  let index = 0;
  for (const item of new Toolbox({ registry: made }).items) {
    surface.place({ kind: 'new', item }, { list: { of: 'elements', container: 'p1' }, index });
    index += 1;
  }
  return surface.definition;
}

function namesIn(definition: SurveyDefinition): readonly string[] {
  const pages = definition['pages'] as readonly Record<string, unknown>[];
  const elements = (pages[0]?.['elements'] ?? []) as readonly Record<string, unknown>[];
  return elements.map((element) => element['name'] as string);
}

test('parity/N5-render: every type the toolbox offers is on the canvas', async () => {
  const made = registry();
  const definition = everyType(made);

  const screen = await render(<SurveyCreator value={definition} registry={made} />);

  await Promise.all(
    namesIn(definition).map((name) =>
      expect.element(screen.getByTestId(`select-${name}`)).toBeInTheDocument(),
    ),
  );
  // K3's design surface is the survey itself rather than a drawing of one, so this is also
  // the first proof that twenty-one types can share a canvas without interfering.
  expect(screen.container.querySelectorAll('.kajay-question--unsupported')).toHaveLength(0);
});

test('parity/N5-render: every type draws in the preview', async () => {
  const made = registry();
  const definition = everyType(made);
  const screen = await render(<SurveyCreator value={definition} registry={made} />);

  await screen.getByTestId('creator-tab-preview').click();
  await expect.element(screen.getByTestId('preview-frame')).toBeInTheDocument();

  // **The assertion the model cannot make.** A type with no registered renderer parses,
  // round-trips and records answers exactly like one that has one; the only place the
  // difference shows is here, as the box the dispatcher draws when it has nothing to draw.
  expect(screen.container.querySelectorAll('.kajay-question--unsupported')).toHaveLength(0);
  for (const name of namesIn(definition)) {
    const slot = screen.container.querySelector(`[data-element-slot="${name}"]`);
    expect(slot, `${name} has no slot in the preview`).not.toBeNull();
  }
});

test('parity/N5-render: a question arrives from the toolbox with something to answer', async () => {
  const made = registry();
  const definition = everyType(made);
  const screen = await render(<SurveyCreator value={definition} registry={made} />);

  await screen.getByTestId('creator-tab-preview').click();
  await expect.element(screen.getByTestId('preview-frame')).toBeInTheDocument();

  // N5's finding, seen from the side a designer sees it from: before this row, dropping a
  // radio group produced a question with a title and nothing under it. The count is three
  // because that is what the toolbox now starts one with — see `builtInToolbox`.
  await expect.element(screen.getByTestId('preview-frame')).toContainElement(
    screen.container.querySelector('[data-element-slot="radiogroup1"] input') as HTMLElement,
  );
  const radios = screen.container.querySelectorAll(
    '[data-element-slot="radiogroup1"] input[type="radio"]',
  );
  expect(radios).toHaveLength(3);
  const rows = screen.container.querySelectorAll('[data-element-slot="matrix1"] tbody tr');
  expect(rows).toHaveLength(2);
});
