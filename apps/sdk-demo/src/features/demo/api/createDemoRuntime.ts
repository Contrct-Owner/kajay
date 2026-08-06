import type { DemoRuntime } from './DemoRuntime.js';
import { ComparingDemoRuntime } from './ComparingDemoRuntime.js';
import { HttpDemoRuntime } from './HttpDemoRuntime.js';

export interface DemoRuntimeCatalog {
  readonly available: readonly DemoRuntime[];
  readonly initial: DemoRuntime;
}

export function createDemoRuntimes(configured: unknown): DemoRuntimeCatalog {
  const dotnet = new HttpDemoRuntime('dotnet', '/api/dotnet');
  const typescript = new HttpDemoRuntime('typescript', '/api/typescript');
  if (configured === 'compare') {
    const compare = new ComparingDemoRuntime(dotnet, typescript);
    return { available: [compare, dotnet, typescript], initial: compare };
  }
  const initial = configured === 'typescript' ? typescript : dotnet;
  return { available: [initial], initial };
}
