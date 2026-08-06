import type {
  DemoComparison,
  DemoDefinitionResult,
  DemoDiagnostic,
  DemoSubmissionError,
  DemoSubmissionResult,
} from './DemoRuntimeTypes.js';

export function compareDefinitionResults(
  dotnet: DemoDefinitionResult,
  typescript: DemoDefinitionResult,
): DemoComparison {
  return compareFields([
    field('accepted', dotnet.accepted, typescript.accepted),
    field('canonical definition', dotnet.definition, typescript.definition),
    field('diagnostics', stableDiagnostics(dotnet.diagnostics), stableDiagnostics(typescript.diagnostics)),
  ]);
}

export function compareSubmissionResults(
  dotnet: DemoSubmissionResult,
  typescript: DemoSubmissionResult,
): DemoComparison {
  return compareFields([
    field('accepted', dotnet.accepted, typescript.accepted),
    field('completed', dotnet.completed, typescript.completed),
    field('outcome', dotnet.outcome, typescript.outcome),
    field('response data', dotnet.data, typescript.data),
    field('quiz score', dotnet.score, typescript.score),
    field('validation errors', stableErrors(dotnet.errors), stableErrors(typescript.errors)),
    field('diagnostics', stableDiagnostics(dotnet.diagnostics), stableDiagnostics(typescript.diagnostics)),
  ]);
}

export function compareAnswerErrors(
  dotnet: readonly DemoSubmissionError[],
  typescript: readonly DemoSubmissionError[],
): DemoComparison {
  return compareFields([
    field('answer validation errors', stableErrors(dotnet), stableErrors(typescript)),
  ]);
}

interface ComparedField {
  readonly name: string;
  readonly matches: boolean;
}

function field(name: string, dotnet: unknown, typescript: unknown): ComparedField {
  return { name, matches: stableJson(dotnet) === stableJson(typescript) };
}

function compareFields(fields: readonly ComparedField[]): DemoComparison {
  const differences = fields.filter(({ matches }) => !matches).map(({ name }) => name);
  return { matched: differences.length === 0, differences };
}

function stableDiagnostics(diagnostics: readonly DemoDiagnostic[]): unknown {
  return diagnostics.map(({ code, path, severity }) => ({ code, path, severity }));
}

function stableErrors(errors: readonly DemoSubmissionError[]): unknown {
  return errors.map(({ name, kind, path }) => ({ name, kind, path }));
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sortJson(item));
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortJson(child)]),
  );
}
