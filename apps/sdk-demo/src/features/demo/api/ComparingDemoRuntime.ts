import type { SurveyDefinition } from '@kajay/core';
import type { DemoRuntime } from './DemoRuntime.js';
import type {
  DemoDefinitionResult,
  DemoSubmissionError,
  DemoSubmissionResult,
  DemoSnapshotResult,
} from './DemoRuntimeTypes.js';
import {
  compareAnswerErrors,
  compareDefinitionResults,
  compareSubmissionResults,
} from './DemoCompatibilityComparison.js';

/** Fans one operation into both real runtime adapters and compares stable results. */
export class ComparingDemoRuntime implements DemoRuntime {
  readonly name = 'compare' as const;
  readonly #dotnet: DemoRuntime;
  readonly #typescript: DemoRuntime;

  constructor(dotnet: DemoRuntime, typescript: DemoRuntime) {
    this.#dotnet = dotnet;
    this.#typescript = typescript;
  }

  async loadDefinition(): Promise<DemoDefinitionResult> {
    const [dotnet, typescript] = await Promise.all([
      this.#dotnet.loadDefinition(),
      this.#typescript.loadDefinition(),
    ]);
    return mergeDefinition(dotnet, typescript);
  }

  async validateDefinition(definition: SurveyDefinition): Promise<DemoDefinitionResult> {
    const [dotnet, typescript] = await Promise.all([
      this.#dotnet.validateDefinition(definition),
      this.#typescript.validateDefinition(definition),
    ]);
    return mergeDefinition(dotnet, typescript);
  }

  async validateAnswers(
    data: Readonly<Record<string, unknown>>,
    questionNames: readonly string[],
  ): Promise<readonly DemoSubmissionError[]> {
    const [dotnet, typescript] = await Promise.all([
      this.#dotnet.validateAnswers(data, questionNames),
      this.#typescript.validateAnswers(data, questionNames),
    ]);
    const comparison = compareAnswerErrors(dotnet, typescript);
    if (!comparison.matched) {
      throw new Error(`SDK runtimes disagreed about ${comparison.differences.join(', ')}.`);
    }
    return dotnet;
  }

  async submit(
    definition: SurveyDefinition,
    data: Readonly<Record<string, unknown>>,
  ): Promise<DemoSubmissionResult> {
    const [dotnet, typescript] = await Promise.all([
      this.#dotnet.submit(definition, data),
      this.#typescript.submit(definition, data),
    ]);
    const comparison = compareSubmissionResults(dotnet, typescript);
    return {
      ...dotnet,
      runtime: this.name,
      accepted: dotnet.accepted && typescript.accepted && comparison.matched,
      comparison,
    };
  }

  async roundTripSnapshot(
    definition: SurveyDefinition,
    data: Readonly<Record<string, unknown>>,
  ): Promise<DemoSnapshotResult> {
    const [dotnet, typescript] = await Promise.all([
      this.#dotnet.roundTripSnapshot(definition, data),
      this.#typescript.roundTripSnapshot(definition, data),
    ]);
    const differences: string[] = [];
    if (dotnet.definitionDigest !== typescript.definitionDigest) differences.push('definition digest');
    if (JSON.stringify(dotnet.snapshot) !== JSON.stringify(typescript.snapshot)) differences.push('snapshot');
    if (JSON.stringify(dotnet.restoredData) !== JSON.stringify(typescript.restoredData)) {
      differences.push('restored data');
    }
    return {
      ...dotnet,
      runtime: 'compare',
      comparison: { matched: differences.length === 0, differences },
    };
  }
}

function mergeDefinition(
  dotnet: DemoDefinitionResult,
  typescript: DemoDefinitionResult,
): DemoDefinitionResult {
  const comparison = compareDefinitionResults(dotnet, typescript);
  return {
    ...dotnet,
    runtime: 'compare',
    accepted: dotnet.accepted && typescript.accepted && comparison.matched,
    comparison,
  };
}
