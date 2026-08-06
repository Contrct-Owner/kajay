import type { SurveyDefinition } from '@kajay/core';
import type { DemoRuntime } from './DemoRuntime.js';
import type {
  DemoDefinitionResult,
  DemoSubmissionError,
  DemoSubmissionResult,
} from './DemoRuntimeTypes.js';
import {
  readAnswerValidationResult,
  readDefinitionResult,
  readSubmissionResult,
} from './demoResponseSchemas.js';

function readJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new Error(`Kajay demo API returned ${response.status} ${response.statusText}.`);
  }
  return response.json() as Promise<unknown>;
}

async function post(path: string, body: unknown): Promise<unknown> {
  return readJson(
    await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

/** Remote adapter: every authoritative operation crosses the C# API boundary. */
export class HttpDemoRuntime implements DemoRuntime {
  readonly name = 'dotnet' as const;

  async loadDefinition(): Promise<DemoDefinitionResult> {
    return readDefinitionResult(await readJson(await fetch('/api/demo/definition')));
  }

  async validateDefinition(definition: SurveyDefinition): Promise<DemoDefinitionResult> {
    return readDefinitionResult(await post('/api/demo/definitions/validate', { definition }));
  }

  async validateAnswers(
    data: Readonly<Record<string, unknown>>,
    questionNames: readonly string[],
  ): Promise<readonly DemoSubmissionError[]> {
    return readAnswerValidationResult(
      await post('/api/demo/answers/validate', { data, questionNames }),
    );
  }

  async submit(
    definition: SurveyDefinition,
    data: Readonly<Record<string, unknown>>,
  ): Promise<DemoSubmissionResult> {
    return readSubmissionResult(await post('/api/demo/submissions', { definition, data }));
  }
}
