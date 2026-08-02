import { AsyncValidator, globalRegistry } from '@kajay/core';
import { recordCheckEvent } from './checkLog.js';
import type {
  ServerValidationError,
  ServerValidator,
  SurveyError,
  ValidationContext,
} from '@kajay/core';

/**
 * The checks a host adds for itself — checklist D3 and D4.
 *
 * Both stand in for a network call with a timer, because the demo has to be
 * deterministic and because what the rows are about is the *seam*, not the transport.
 * The `choicesByUrl` question a few lines away already makes a real request, so nothing
 * here is pretending the real thing is unproven.
 */
function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * A custom async validator, registered the way any host would register one.
 *
 * Nothing about it ships in the library: the subclass is the host's, and the registry
 * entry is what makes `{"type": "reservednamevalidator"}` legal in the definition —
 * the same route every built-in type takes.
 */
class ReservedNameValidator extends AsyncValidator {
  override get type(): string {
    return 'reservednamevalidator';
  }

  override async validateAsync({ value }: ValidationContext): Promise<SurveyError | undefined> {
    // Recorded on both sides of the wait, because "entered and never came back" and
    // "came back, and the survey stayed checking anyway" are different defects with the
    // same symptom, and the page said nothing that could tell them apart.
    recordCheckEvent('nickname lookup started');
    await delay(300);
    recordCheckEvent('nickname lookup returned');
    const text = String(value).trim().toLowerCase();
    return text === 'admin'
      ? { kind: this.type, text: `"${String(value)}" is already taken.` }
      : undefined;
  }
}

globalRegistry.addClass({
  name: 'reservednamevalidator',
  parent: 'validator',
  create: () => new ReservedNameValidator(),
});

/**
 * The server seam: one round trip for the whole page under the gate.
 *
 * A real host would post `data` and translate the response. The shape of the answer is
 * what matters — an error names the question it belongs to, so the model can put it
 * where the respondent will see it.
 */
export const validateOnServer: ServerValidator = async ({ data, questionNames }) => {
  recordCheckEvent('server check started');
  // Deliberately brief. A server validator runs on *every* gate, so an artificially
  // slow one taxes every scenario in the suite — and what D4 proves is the seam, not
  // the latency. The visible waiting state is demonstrated by the validator above,
  // which fires on one field.
  await delay(60);
  recordCheckEvent('server check returned');
  const errors: ServerValidationError[] = [];
  if (questionNames.includes('price') && Number(data['price']) === 13) {
    errors.push({ questionName: 'price', text: 'Our billing system refuses 13. Sorry.' });
  }
  return errors;
};
