import type { DemoRuntime } from './DemoRuntime.js';
import { HttpDemoRuntime } from './HttpDemoRuntime.js';
import { LocalDemoRuntime } from './LocalDemoRuntime.js';

export function createDemoRuntime(configured: unknown): DemoRuntime {
  return configured === 'typescript' ? new LocalDemoRuntime() : new HttpDemoRuntime();
}
