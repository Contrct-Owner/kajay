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

/** Remote adapter: every authoritative operation crosses one SDK API boundary. */
export class HttpDemoRuntime implements DemoRuntime {
  readonly name: 'dotnet' | 'typescript';
  readonly #basePath: string;

  constructor(name: 'dotnet' | 'typescript', basePath: string) {
    this.name = name;
    this.#basePath = basePath;
  }

  async loadDefinition(): Promise<DemoDefinitionResult> {
    return readDefinitionResult(await readJson(await fetch(`${this.#basePath}/demo/definition`)));
  }

  async validateDefinition(definition: SurveyDefinition): Promise<DemoDefinitionResult> {
    return readDefinitionResult(
      await post(`${this.#basePath}/demo/definitions/validate`, { definition }),
    );
  }

  async validateAnswers(
    data: Readonly<Record<string, unknown>>,
    questionNames: readonly string[],
  ): Promise<readonly DemoSubmissionError[]> {
    return readAnswerValidationResult(
      await post(`${this.#basePath}/demo/answers/validate`, { data, questionNames }),
    );
  }

  async submit(
    definition: SurveyDefinition,
    data: Readonly<Record<string, unknown>>,
  ): Promise<DemoSubmissionResult> {
    return readSubmissionResult(
      await post(`${this.#basePath}/demo/submissions`, { definition, data }),
    );
  }
}
