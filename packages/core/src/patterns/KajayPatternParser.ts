import {
  alternation,
  EMPTY_PATTERN,
  sequence,
  type CharacterClassItem,
  type PatternNode,
  type ScalarPattern,
  type ShorthandName,
} from './KajayPatternNode.js';

const MAX_SOURCE_SCALARS = 512;
const MAX_REPETITION = 1_000;
const SHORTHAND_ESCAPES = new Set<string>(['d', 'D', 'w', 'W', 's', 'S']);

export function parseKajayPattern(source: string): PatternNode | undefined {
  let count = 0;
  for (const scalar of source) {
    const value = scalar.codePointAt(0)!;
    count += 1;
    if (count > MAX_SOURCE_SCALARS || (value >= 0xd800 && value <= 0xdfff)) {
      return undefined;
    }
  }
  return new PatternParser(source).parse();
}

class PatternParser {
  readonly #source: string;
  #index = 0;
  #valid = true;

  constructor(source: string) {
    this.#source = source;
  }

  parse(): PatternNode | undefined {
    const node = this.#alternation();
    return this.#valid && this.#index === this.#source.length ? node : undefined;
  }

  #alternation(terminator?: string): PatternNode {
    const alternatives = [this.#sequence(terminator)];
    while (this.#peek() === '|') {
      this.#index += 1;
      alternatives.push(this.#sequence(terminator));
    }
    return alternation(alternatives);
  }

  #sequence(terminator?: string): PatternNode {
    const items: PatternNode[] = [];
    while (this.#index < this.#source.length) {
      const current = this.#peek();
      if (current === '|' || current === terminator) {
        break;
      }
      items.push(this.#atom());
    }
    return sequence(items);
  }

  #atom(): PatternNode {
    const current = this.#take();
    let node: PatternNode;
    switch (current) {
      case undefined:
      case ')':
      case ']':
      case '}':
      case '*':
      case '+':
      case '?':
      case '{':
        return this.#fail();
      case '^':
        return { kind: 'anchor', edge: 'start' };
      case '$':
        return { kind: 'anchor', edge: 'end' };
      case '(':
        if (this.#peek() === '?') {
          return this.#fail();
        }
        node = this.#alternation(')');
        if (this.#take() !== ')') {
          return this.#fail();
        }
        break;
      case '[':
        node = { kind: 'scalar', scalar: this.#characterClass() };
        break;
      case '\\': {
        const escaped = this.#escape();
        node = escaped === undefined ? this.#fail() : { kind: 'scalar', scalar: escaped };
        break;
      }
      case '.':
        node = { kind: 'scalar', scalar: { kind: 'dot' } };
        break;
      default:
        node = { kind: 'scalar', scalar: { kind: 'literal', value: current.codePointAt(0)! } };
        break;
    }
    return this.#quantifier(node);
  }

  #characterClass(): ScalarPattern {
    const negated = this.#peek() === '^';
    if (negated) {
      this.#index += 1;
    }
    const items: CharacterClassItem[] = [];
    while (this.#index < this.#source.length && this.#peek() !== ']') {
      const start = this.#classItem();
      if (start === undefined) {
        return this.#failedClass();
      }
      if (this.#peek() !== '-') {
        items.push(start);
        continue;
      }
      this.#index += 1;
      const end = this.#classItem();
      if (
        start.kind !== 'range' ||
        start.first !== start.last ||
        end?.kind !== 'range' ||
        end.first !== end.last ||
        end.first < start.first
      ) {
        return this.#failedClass();
      }
      items.push({ kind: 'range', first: start.first, last: end.first });
    }
    if (items.length === 0 || this.#take() !== ']') {
      return this.#failedClass();
    }
    return { kind: 'class', negated, items };
  }

  #classItem(): CharacterClassItem | undefined {
    const current = this.#take();
    if (current === undefined || current === ']' || current === '-') {
      return undefined;
    }
    if (current !== '\\') {
      const value = current.codePointAt(0)!;
      return { kind: 'range', first: value, last: value };
    }
    const escaped = this.#escape();
    if (escaped?.kind === 'shorthand') {
      return escaped;
    }
    return escaped?.kind === 'literal'
      ? { kind: 'range', first: escaped.value, last: escaped.value }
      : undefined;
  }

  #escape(): ScalarPattern | undefined {
    const escaped = this.#take();
    if (escaped === undefined) {
      return undefined;
    }
    if (SHORTHAND_ESCAPES.has(escaped)) {
      return { kind: 'shorthand', name: escaped as ShorthandName };
    }
    if (/^[A-Za-z0-9]$/u.test(escaped)) {
      return undefined;
    }
    return { kind: 'literal', value: escaped.codePointAt(0)! };
  }

  #quantifier(item: PatternNode): PatternNode {
    const current = this.#peek();
    if (current === '*' || current === '+' || current === '?') {
      this.#index += 1;
      return {
        kind: 'repeat',
        item,
        minimum: current === '+' ? 1 : 0,
        ...(current === '*' || current === '+' ? {} : { maximum: 1 }),
      };
    }
    if (current !== '{') {
      return item;
    }
    this.#index += 1;
    const minimum = this.#decimal();
    if (minimum === undefined) {
      return this.#fail();
    }
    let maximum = minimum;
    if (this.#peek() === ',') {
      this.#index += 1;
      maximum = this.#decimal() ?? -1;
    }
    if (this.#take() !== '}' || maximum < minimum || maximum > MAX_REPETITION) {
      return this.#fail();
    }
    return { kind: 'repeat', item, minimum, maximum };
  }

  #decimal(): number | undefined {
    const start = this.#index;
    while (/^[0-9]$/u.test(this.#peek() ?? '')) {
      this.#index += 1;
    }
    return this.#index === start ? undefined : Number(this.#source.slice(start, this.#index));
  }

  #take(): string | undefined {
    const value = this.#peek();
    if (value !== undefined) {
      this.#index += value.length;
    }
    return value;
  }

  #peek(): string | undefined {
    const point = this.#source.codePointAt(this.#index);
    return point === undefined ? undefined : String.fromCodePoint(point);
  }

  #failedClass(): ScalarPattern {
    this.#valid = false;
    return { kind: 'literal', value: 0 };
  }

  #fail(): PatternNode {
    this.#valid = false;
    return EMPTY_PATTERN;
  }
}
