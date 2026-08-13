import { CreatorWorkspace } from '@kajay/creator-core';
import { describe, expect, test } from 'vitest';

const DEFINITION = {
  pages: [{ name: 'p1', elements: [{ type: 'text', name: 'q', visibleIf: "{$tier} = 'gold'" }] }],
};

describe('parity/B12-creator-host-value-names', () => {
  test('an undeclared host value is reported on a canvas like anywhere else', () => {
    const workspace = new CreatorWorkspace({ definition: DEFINITION });

    expect(workspace.surface.diagnostics.map((d) => d.code)).toEqual(['undeclared-host-value']);
    workspace.dispose();
  });

  test('declaring the name silences it, because the host has said it will supply one', () => {
    const workspace = new CreatorWorkspace({ definition: DEFINITION, hostValueNames: ['tier'] });

    // Names, not values: a canvas has no host, so there is nothing true to show — but the
    // vocabulary is enough to stop reporting a valid definition as broken.
    expect(workspace.surface.diagnostics).toEqual([]);
    workspace.dispose();
  });

  test('a declared name still reads as unanswered, not as a value', () => {
    const workspace = new CreatorWorkspace({ definition: DEFINITION, hostValueNames: ['tier'] });

    // Declared and absent, so the condition simply does not hold. Inventing a value here
    // would be a fiction a designer could come to rely on.
    expect(workspace.surface.survey.getQuestionByName('q')?.isVisible).toBe(false);
    workspace.dispose();
  });
});
