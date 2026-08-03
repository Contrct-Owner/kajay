import { RankingQuestion } from '@kajay/core';
import type { ItemValue } from '@kajay/core';
import type { ReactElement } from 'react';
import { Fragment } from 'react';
import type { QuestionRendererProps } from './QuestionRendererProps.js';
import { QuestionErrors } from './QuestionErrors.js';
import { QuestionTitleContent } from './QuestionTitleContent.js';
import { readOnlyGroup } from './readOnly.js';
import { useReorder } from './useReorder.js';
import { useSurveyValue } from './useSurveyState.js';

const HOW_TO_REORDER =
  'Press space to pick this up, then use the arrow keys to move it and space again to drop it.';

function rankingHeading(question: RankingQuestion): string {
  if (question.isReadOnly) {
    return 'Your ranking';
  }
  return question.selectToRankEnabled ? 'Your ranking' : 'Drag or use the keyboard to reorder';
}

/**
 * The ranking itself: rows that can be dragged or walked into place.
 *
 * Every row is a real `<button>`, so it is in the tab order, has a focus ring and
 * announces itself without anything being simulated. The interaction is
 * `useReorder`, which knows nothing about questions — this component only says how many
 * rows there are, what moving one means, and what each is called.
 */
function RankedList({ question }: { readonly question: RankingQuestion }): ReactElement {
  const ranked = question.rankedChoices;
  const listId = `kajay-question-${question.name}-ranked`;
  const reorder = useReorder({
    itemCount: ranked.length,
    onMove: (from, to) => question.moveRanked(from, to),
    // Read live rather than closed over `ranked`: this is called to describe where a
    // row *landed*, by which time the order has already changed.
    describe: (index) => question.rankedChoices[index]?.text ?? '',
  });

  return (
    <div className="kajay-ranking__area" role="group" aria-labelledby={`${listId}-heading`}>
      <p className="kajay-ranking__heading" id={`${listId}-heading`}>
        {rankingHeading(question)}
      </p>
      {question.isReadOnly ? null : (
        <p className="kajay-ranking__hint" id={`${listId}-hint`}>
          {HOW_TO_REORDER}
        </p>
      )}
      {/* The rows are direct children, and the remove buttons alongside them: that is
          the contract `useReorder` reads positions through, and a wrapper per row would
          break it. */}
      <div className="kajay-ranking__list" ref={reorder.listRef}>
        {ranked.map((choice, index) => (
          <Fragment key={String(choice.value)}>
            <button
              type="button"
              className="kajay-ranking__row"
              // Reading: no hint and no handlers, because there is nothing to grab. The
              // order itself is the answer and stays on the page to be read.
              aria-describedby={question.isReadOnly ? undefined : `${listId}-hint`}
              {...(question.isReadOnly ? {} : reorder.getItemProps(index))}
            >
              <span className="kajay-ranking__rank">{index + 1}</span>
              <span className="kajay-ranking__text">{choice.text}</span>
            </button>
            {question.selectToRankEnabled && !question.isReadOnly ? (
              <UnrankButton question={question} choice={choice} />
            ) : null}
          </Fragment>
        ))}
        {ranked.length === 0 ? (
          <p className="kajay-ranking__empty">Nothing ranked yet.</p>
        ) : null}
      </div>
      {/* Assertive, because a row sliding past its neighbours is the entire feedback a
          sighted respondent gets, and none of it reaches anyone else. */}
      <div className="kajay-ranking__live" aria-live="assertive" aria-atomic="true">
        {reorder.announcement}
      </div>
    </div>
  );
}

/** One choice waiting to be ranked. */
function PoolChoice({
  question,
  choice,
}: {
  readonly question: RankingQuestion;
  readonly choice: ItemValue;
}): ReactElement {
  return (
    <button
      type="button"
      className="kajay-ranking__pool-choice"
      // The visible text is the choice; the name says what pressing it does, because
      // "Speed" on its own is not an action.
      aria-label={`Rank ${choice.text}`}
      onClick={() => {
        question.rank(choice.value);
      }}
    >
      {choice.text}
    </button>
  );
}

/** The choices nobody has placed yet. Only `selectToRankEnabled` has one. */
function RankingPool({ question }: { readonly question: RankingQuestion }): ReactElement {
  const poolId = `kajay-question-${question.name}-pool`;
  const unranked = question.unrankedChoices;
  return (
    <div className="kajay-ranking__area" role="group" aria-labelledby={`${poolId}-heading`}>
      <p className="kajay-ranking__heading" id={`${poolId}-heading`}>
        Choices
      </p>
      <div className="kajay-ranking__pool">
        {unranked.map((choice) => (
          <PoolChoice key={String(choice.value)} question={question} choice={choice} />
        ))}
        {unranked.length === 0 ? (
          <p className="kajay-ranking__empty">Everything has been ranked.</p>
        ) : null}
      </div>
    </div>
  );
}

/** Removes a ranked choice, putting it back among the choices. */
function UnrankButton({
  question,
  choice,
}: {
  readonly question: RankingQuestion;
  readonly choice: ItemValue;
}): ReactElement {
  return (
    <button
      type="button"
      className="kajay-ranking__unrank"
      aria-label={`Remove ${choice.text} from the ranking`}
      onClick={() => {
        question.unrank(choice.value);
      }}
    >
      ×
    </button>
  );
}

/**
 * Choices put in order.
 *
 * Two shapes from one model: with `selectToRankEnabled` there is a pool to draw from
 * and a ranking to fill, and without it the ranking is the whole list. The renderer
 * decides nothing about either — which choices are where, and what happens when one
 * moves, is `RankingQuestion`'s business, so a keyboard move and a drag land in exactly
 * the same place.
 */
export function RankingQuestionRenderer({ survey, question }: QuestionRendererProps): ReactElement {
  useSurveyValue(survey, question.name);

  if (!(question instanceof RankingQuestion)) {
    return <div className="kajay-question kajay-question--unsupported" />;
  }

  const groupName = `kajay-question-${question.name}`;
  const errorId = `${groupName}-errors`;

  return (
    <fieldset
      className="kajay-question kajay-question--ranking"
      data-question-name={question.name}
      disabled={!question.isEnabled}
      aria-required={question.isRequired}
      aria-invalid={question.hasErrors || undefined}
      aria-describedby={question.hasErrors ? errorId : undefined}
      {...readOnlyGroup(question.isReadOnly)}
    >
      <legend className="kajay-question__title">
        <QuestionTitleContent question={question} />
      </legend>
      <QuestionErrors survey={survey} question={question} at="top" id={errorId} />

      <div className="kajay-ranking" data-layout={question.selectToRankAreasLayout}>
        {question.selectToRankEnabled && !question.isReadOnly ? (
          <RankingPool question={question} />
        ) : null}
        <RankedList question={question} />
      </div>

      <QuestionErrors survey={survey} question={question} at="bottom" id={errorId} />
    </fieldset>
  );
}
