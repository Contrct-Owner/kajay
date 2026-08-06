import type { ScalarPattern } from './KajayPatternNode.js';

export type PatternState = AcceptState | MatchState | BranchState | AnchorState;

interface AcceptState {
  readonly kind: 'accept';
}

interface MatchState {
  readonly kind: 'match';
  readonly scalar: ScalarPattern;
  readonly next: PatternState;
}

export interface BranchState {
  readonly kind: 'branch';
  first?: PatternState;
  readonly second: PatternState;
}

interface AnchorState {
  readonly kind: 'anchor';
  readonly edge: 'start' | 'end';
  readonly next: PatternState;
}
