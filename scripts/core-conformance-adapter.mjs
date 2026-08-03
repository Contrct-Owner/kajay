/**
 * The TypeScript runtime adapter for the language-neutral conformance interface.
 *
 * A future .NET runner implements these same four operations. Corpus files know
 * nothing about TypeScript classes, events, or `undefined`; those details end here.
 */
export class CoreConformanceAdapter {
  #core;

  constructor(core) {
    this.#core = core;
  }

  canonicalizeDefinition(input) {
    const parsed = this.#core.parseSurvey(input);
    return {
      canonical: this.#core.serializeSurvey(parsed.survey),
      diagnostics: parsed.diagnostics.map(({ code, path, severity }) => ({ code, path, severity })),
    };
  }

  parseExpression(source) {
    const parsed = this.#core.parseExpression(source);
    return {
      canonical: parsed.errors.length === 0 ? this.#core.printExpression(parsed.node) : null,
      errorCodes: parsed.errors.map(({ code }) => code),
    };
  }

  evaluateExpression(testCase, clock) {
    const parsed = this.#core.parseExpression(testCase.source);
    if (parsed.errors.length > 0) {
      return { result: encodeValue(), errorCodes: parsed.errors.map(({ code }) => code) };
    }
    const functions = this.#core.createDefaultFunctionRegistry();
    const asyncFunction = testCase.asyncFunction;
    if (asyncFunction !== undefined) {
      functions.registerAsync(asyncFunction.name, () => Promise.resolve(null));
    }
    const result = this.#core.evaluateExpression(parsed.node, {
      getValue: this.#core.createValueResolver(testCase.data ?? {}),
      functions,
      now: new Date(clock),
      ...(asyncFunction?.outcome === undefined
        ? {}
        : { asyncValues: asyncValuesFor(asyncFunction.outcome) }),
    });
    return {
      result: encodeValue(result.value),
      errorCodes: result.errors.map(({ code }) => code),
    };
  }

  runLifecycleScenario(scenario) {
    const survey = this.#core.parseSurvey(scenario.definition).survey;
    const initialState = survey.status.state;
    const events = [];
    survey.onValueChanged.add(({ name, previousValue, value }) => {
      events.push({
        type: 'value-changed',
        name,
        previousValue: encodeValue(previousValue),
        value: encodeValue(value),
      });
    });
    survey.onComplete.add(({ data }) => {
      events.push({ type: 'complete', data });
    });
    survey.onStateChanged.add(({ state }) => {
      events.push({ type: 'state-changed', state });
    });

    const steps = scenario.actions.map((action) => {
      events.length = 0;
      applyLifecycleAction(survey, action);
      return { state: survey.status.state, events: [...events] };
    });
    return { initialState, steps };
  }
}

function asyncValuesFor(outcome) {
  return {
    request(_name, _args, report) {
      switch (outcome.kind) {
        case 'pending':
          return;
        case 'resolved':
          return outcome.value;
        case 'failed':
          report(outcome.message);
          return;
        default:
          throw new Error(`Unknown asynchronous outcome ${JSON.stringify(outcome.kind)}.`);
      }
    },
  };
}

function encodeValue(value) {
  if (value === undefined) {
    return { kind: 'undefined' };
  }
  if (value instanceof Date) {
    return { kind: 'date', value: value.toISOString() };
  }
  return { kind: 'json', value };
}

function applyLifecycleAction(survey, action) {
  switch (action.kind) {
    case 'set-loading':
      survey.status.setLoading(action.value);
      return;
    case 'enter-preview':
      survey.status.enterPreview();
      return;
    case 'cancel-preview':
      survey.status.cancelPreview();
      return;
    case 'set-value':
      survey.setValue(action.name, action.value);
      return;
    case 'complete':
      survey.complete();
      return;
    default:
      throw new Error(`Unknown lifecycle action ${JSON.stringify(action.kind)}.`);
  }
}
