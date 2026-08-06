import { KajayPatternCompiler } from './KajayPatternCompiler.js';
import { parseKajayPattern } from './KajayPatternParser.js';
import type {
  CharacterClassItem,
  ScalarPattern,
  ShorthandName,
} from './KajayPatternNode.js';
import type { PatternState } from './KajayPatternState.js';

const MAX_INPUT_CODE_UNITS = 64 * 1_024;

/** A compiled Kajay Pattern Profile v1 matcher. */
export class KajayPattern {
  readonly #start: PatternState;

  private constructor(start: PatternState) {
    this.#start = start;
  }

  static compile(source: string): KajayPattern | undefined {
    const node = parseKajayPattern(source);
    if (node === undefined) {
      return undefined;
    }
    const start = new KajayPatternCompiler().compile(node);
    return start === undefined ? undefined : new KajayPattern(start);
  }

  /** Searches a value unless the authored pattern anchors itself. */
  test(value: string): boolean {
    if (value.length > MAX_INPUT_CODE_UNITS) {
      return false;
    }
    const input = [...value].map((scalar) => {
      const point = scalar.codePointAt(0)!;
      return point >= 0xd800 && point <= 0xdfff ? 0xfffd : point;
    });
    let current = closure([this.#start], 0, input.length);
    if (hasAccept(current)) {
      return true;
    }
    for (let index = 0; index < input.length; index += 1) {
      const seeds: PatternState[] = [this.#start];
      for (const state of current) {
        if (state.kind === 'match' && matches(state.scalar, input[index]!)) {
          seeds.push(state.next);
        }
      }
      current = closure(seeds, index + 1, input.length);
      if (hasAccept(current)) {
        return true;
      }
    }
    return false;
  }
}

function closure(
  seeds: readonly PatternState[],
  position: number,
  length: number,
): ReadonlySet<PatternState> {
  const reached = new Set<PatternState>();
  const pending = [...seeds];
  while (pending.length > 0) {
    const state = pending.pop()!;
    if (reached.has(state)) {
      continue;
    }
    reached.add(state);
    if (state.kind === 'branch') {
      if (state.first !== undefined) {
        pending.push(state.first);
      }
      pending.push(state.second);
    } else if (state.kind === 'anchor' && (state.edge === 'start' ? position === 0 : position === length)) {
      pending.push(state.next);
    }
  }
  return reached;
}

function hasAccept(states: ReadonlySet<PatternState>): boolean {
  return [...states].some((state) => state.kind === 'accept');
}

function matches(pattern: ScalarPattern, scalar: number): boolean {
  switch (pattern.kind) {
    case 'literal':
      return scalar === pattern.value;
    case 'dot':
      return scalar !== 0x0a && scalar !== 0x0d && scalar !== 0x2028 && scalar !== 0x2029;
    case 'shorthand':
      return matchesShorthand(pattern.name, scalar);
    case 'class': {
      const contained = pattern.items.some((item) => matchesClassItem(item, scalar));
      return pattern.negated ? !contained : contained;
    }
  }
}

function matchesClassItem(item: CharacterClassItem, scalar: number): boolean {
  return item.kind === 'range'
    ? scalar >= item.first && scalar <= item.last
    : matchesShorthand(item.name, scalar);
}

function matchesShorthand(name: ShorthandName, scalar: number): boolean {
  const positive = name.toLowerCase();
  const matched = positive === 'd'
    ? scalar >= 0x30 && scalar <= 0x39
    : positive === 'w'
      ? (scalar >= 0x30 && scalar <= 0x39) ||
        (scalar >= 0x41 && scalar <= 0x5a) ||
        (scalar >= 0x61 && scalar <= 0x7a) ||
        scalar === 0x5f
      : isPatternSpace(scalar);
  return name === positive ? matched : !matched;
}

function isPatternSpace(scalar: number): boolean {
  return (scalar >= 0x09 && scalar <= 0x0d) ||
    scalar === 0x20 ||
    scalar === 0xa0 ||
    scalar === 0x1680 ||
    (scalar >= 0x2000 && scalar <= 0x200a) ||
    scalar === 0x2028 ||
    scalar === 0x2029 ||
    scalar === 0x202f ||
    scalar === 0x205f ||
    scalar === 0x3000 ||
    scalar === 0xfeff;
}
