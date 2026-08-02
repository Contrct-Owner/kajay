import { aboutYou } from './pages/aboutYou.js';
import { logicShowcase } from './pages/logicShowcase.js';
import { questionTypes } from './pages/questionTypes.js';

/**
 * The demo fixture, authored the way a host would author it.
 *
 * `department` is deliberately not a property the registry declares. It proves two
 * checklist rows at once: A1 (unknown properties are surfaced, not dropped) and A2
 * (they survive the round-trip verbatim).
 */
export const surveyDefinition: Readonly<Record<string, unknown>> = {
  // Deliberately not named for a phase: it goes stale every time the demo grows.
  title: 'Kajay demo',
  triggers: [
    {
      // Writes annualEstimate from price when the plan becomes paid.
      type: 'runexpression',
      expression: "{plan} == 'paid'",
      runExpression: '{price} * 12',
      setToName: 'annualEstimate',
    },
    {
      // Snapshots the name once a primary topic is picked.
      type: 'copyvalue',
      expression: '{primaryTopic} notempty',
      setToName: 'contactName',
      fromName: 'fullName',
    },
    {
      type: 'complete',
      expression: "{finishNow} == 'yes'",
    },
    {
      // The mirror image: not finishing sends you back to review. `skip` had no
      // observable effect until the renderer paginated — it moves `currentPageNo`, and
      // with every page on screen at once there was nothing to see.
      type: 'skip',
      expression: "{finishNow} == 'no'",
      gotoName: 'page1',
    },
    {
      // Fires on the transition into true, so it stamps once rather than on every
      // keystroke afterwards.
      type: 'setvalue',
      expression: '{answeredCount} == 3',
      setToName: 'status',
      setValue: 'complete',
    },
  ],
  calculatedValues: [
    {
      name: 'answeredCount',
      expression: 'count({fullName}, {nickname}, {email})',
      // Included, so it joins the answers and shows up in the panel below.
      includeIntoResult: true,
    },
  ],
  description: 'Conditional logic, rendered through the published package APIs.',
  // The strict policy, because it is the one you can watch happen: emptying the name
  // takes the nickname, the email and the greeting with it, in the same keystroke.
  clearInvisibleValues: 'onHidden',
  // A last look before submitting, showing only what they actually answered — a review
  // screen listing every untouched optional question buries the ones that matter.
  showPreviewBeforeComplete: 'showAnsweredQuestions',
  // The ending is authored, and reads back what the respondent told us. `{fullName}` is
  // an answer and `{answeredCount}` is a calculated value — the completed page makes no
  // distinction, which is the half of B6 that had nowhere to be proven.
  completedHtml:
    '<h2>Thanks, {fullName}.</h2><p>You answered {answeredCount} of the first three questions.</p>',
  completedHtmlOnCondition: [
    {
      // Reaching the end early is a different ending, not the same one with a caveat.
      expression: "{finishNow} == 'yes'",
      html: '<h2>Finished early</h2><p>You chose to stop on the logic page, so we skipped the rest.</p>',
    },
  ],
  pages: [aboutYou, logicShowcase, questionTypes],
};
