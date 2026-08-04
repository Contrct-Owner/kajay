import { DesignSurface, Toolbox } from '@kajay/creator-core';
import type { SurveyDefinition } from '@kajay/core';

/**
 * One of every type the toolbox offers — checklist N5.
 *
 * **Built by driving the Creator**, not written out as JSON, which is the row's demand:
 * a hand-written definition would prove the parser handles every type and say nothing
 * about whether a designer can produce one. Every element here is the result of a drop.
 *
 * The list of types is the toolbox's, so nothing here names one. That is what makes this
 * a demonstration rather than a fixture: a type registered tomorrow is in this survey the
 * same day, with whatever the toolbox starts it with.
 */
export function everyTypeSurvey(): SurveyDefinition {
  const surface = new DesignSurface({
    definition: { title: 'One of everything', pages: [{ name: 'p1', title: 'Every type' }] },
  });
  let index = 0;
  for (const item of new Toolbox().items) {
    surface.place({ kind: 'new', item }, { list: { of: 'elements', container: 'p1' }, index });
    index += 1;
  }
  return surface.definition;
}
