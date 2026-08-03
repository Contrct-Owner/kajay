import { createDefaultFunctionRegistry } from '@kajay/core';
import type { FunctionRegistry } from '@kajay/core';

/** Postcodes this imaginary business delivers to. */
const SERVED = new Set(['SW1', 'EC1', 'N1']);

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * The host's own expression functions — checklist B2.
 *
 * `isServed` answers out of process, the way a real coverage check would. Two things
 * about it are worth copying rather than the timer: it returns early for an argument it
 * cannot use, because every asynchronous function is asked once at startup before
 * anybody has answered anything; and it is registered on a registry the host owns and
 * hands to `parseSurvey`, rather than mutating a global.
 */
export function createHostFunctions(): FunctionRegistry {
  const functions = createDefaultFunctionRegistry();
  functions.registerAsync('isserved', async (args) => {
    const postcode = String(args[0] ?? '').toUpperCase();
    if (postcode.length === 0) {
      return false;
    }
    await delay(120);
    return SERVED.has(postcode);
  });
  return functions;
}
