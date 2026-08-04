/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, Question, parseSurvey, registerBuiltInTypes } from '@kajay/core';
import {
  QuestionErrors,
  QuestionTitleContent,
  Survey,
  defaultPageElementRenderers,
  questionErrorId,
  questionId,
  useIdScope,
} from '@kajay/react';
import type { SurveyDefinition } from '@kajay/core';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

/**
 * The rendering seam, exercised the way a host would — checklist P9.
 *
 * **Every import above is from `@kajay/react`'s public entry.** That is the assertion the
 * file exists to make, and it did not hold until P9: `questionId`, `questionErrorId`,
 * `useIdScope`, `QuestionErrors` and `QuestionTitleContent` were private, so a host writing
 * a renderer got `QuestionRendererProps` and had to invent the rest.
 *
 * A4's proof drew a bare `<button>` — no label, no ids, no errors — which is why nothing
 * noticed. This one draws what a real replacement draws: a labelled input wired to its
 * error region.
 */
class SliderQuestion extends Question {
  override get type(): string {
    return 'host-slider';
  }
}

const DEFINITION: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'host-slider', name: 'howMuch', title: 'How much?', isRequired: true },
      ],
    },
  ],
};

function registry(): MetadataRegistry {
  const made = new MetadataRegistry();
  registerBuiltInTypes(made);
  made.addClass({ name: 'host-slider', parent: 'question', create: () => new SliderQuestion() });
  return made;
}

function renderers() {
  const table = defaultPageElementRenderers.clone();
  table.registerQuestion('host-slider', ({ survey, question }) => {
    // The scope is what a host could not reach. Without it the ids below are the same in
    // every survey on the page, which is P7's defect reappearing inside a host's renderer.
    const scope = useIdScope();
    const inputId = questionId(question, scope);
    const errorId = questionErrorId(question, scope);

    return (
      <div className="kajay-question">
        <label htmlFor={inputId}>
          <QuestionTitleContent question={question} />
        </label>
        <input
          id={inputId}
          type="range"
          aria-describedby={errorId}
          value={String(question.value ?? 0)}
          onChange={(event) => {
            question.value = Number(event.target.value);
          }}
        />
        <QuestionErrors survey={survey} question={question} at="bottom" id={errorId} />
      </div>
    );
  });
  return table.freeze();
}

test('parity/P9-renderer-seam: a host renderer built only from public exports labels its input', async () => {
  const made = registry();
  const screen = await render(
    <Survey model={parseSurvey(DEFINITION, made).survey} renderers={renderers()} />,
  );

  // Found by label, which is the whole point of an id a host can compute: the label and
  // the input agree because both came from `questionId`.
  await expect.element(screen.getByLabelText(/How much\?/u)).toBeInTheDocument();
});

test('parity/P9-renderer-seam: two surveys with a host renderer do not collide', async () => {
  const made = registry();
  const table = renderers();
  const screen = await render(
    <>
      <Survey model={parseSurvey(DEFINITION, made).survey} renderers={table} />
      <Survey model={parseSurvey(DEFINITION, made).survey} renderers={table} />
    </>,
  );

  const inputs = [...screen.container.querySelectorAll('input[type="range"]')];
  expect(inputs).toHaveLength(2);

  // The ids differ because the host's renderer asked for the scope — the same guarantee
  // the built-in renderers get, now reachable from outside the package.
  const ids = inputs.map((input) => input.id);
  expect(new Set(ids).size).toBe(2);
  expect(ids.every((id) => id.endsWith('kajay-question-howMuch'))).toBe(true);
});
