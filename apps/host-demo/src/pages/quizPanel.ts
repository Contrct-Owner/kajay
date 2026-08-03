import type { PageDefinition } from '../pageDefinition.js';

/**
 * The quiz — checklist E8.
 *
 * A panel on page three rather than a page of its own, deliberately: a fourth page
 * would change what every other scenario walks through to reach the end, and none of
 * them is about quizzing. It also puts the graded questions somewhere a reader can see
 * that `correctAnswer` is just another property on an ordinary question — nothing here
 * is a special "quiz question" type.
 *
 * The page carries `maxTimeToFinish`, so the timer panel appears on arriving here and
 * nowhere else. Ten minutes: long enough that nobody reading the demo is hurried, and
 * the expiry behaviour is proven where it can be proven honestly — against an injected
 * clock, not by waiting.
 */
export const quizPanel: PageDefinition = {
  type: 'panel',
  name: 'quiz',
  title: 'A short quiz',
  description: 'Graded questions. The bar counts marks, and the ending reports the score.',
  elements: [
    {
      type: 'radiogroup',
      name: 'quizCapital',
      title: 'What is the capital of France?',
      choices: ['Lyon', 'Marseille', 'Paris', 'Toulouse'],
      // One value, one mark. The property is never rendered — it reaches the browser in
      // the definition, which is why a real assessment grades again on the server.
      correctAnswer: 'Paris',
    },
    {
      type: 'checkbox',
      name: 'quizPrimes',
      title: 'Which of these are prime?',
      choices: [2, 3, 4, 9],
      // Two marks, and ticking all four earns none of them: each right choice scores
      // and each wrong one costs, so answering honestly beats answering everything.
      correctAnswer: [2, 3],
    },
  ],
};
