import type { DemoSubmissionError } from './DemoContract.js';

const blockedEmail = 'blocked@example.com';
const blockedMessage = 'This demonstration address is blocked by the host validator.';

export function validateDemoAnswers(
  data: Readonly<Record<string, unknown>>,
  questionNames: readonly string[],
): readonly DemoSubmissionError[] {
  if (questionNames.includes('email') && data['email'] === blockedEmail) {
    return [{ name: 'email', kind: 'server', message: blockedMessage, path: '' }];
  }
  return [];
}
