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
  pages: [aboutYou, logicShowcase, questionTypes],
};
