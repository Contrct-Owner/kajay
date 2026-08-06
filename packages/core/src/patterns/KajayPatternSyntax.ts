const MAX_SOURCE_SCALARS = 512;
const MAX_COMPILED_STATES = 4_096;
const MAX_REPETITION = 1_000;
const SHORTHAND_ESCAPES = new Set(['d', 'D', 'w', 'W', 's', 'S']);

/** Validates the portable, bounded Kajay Pattern Profile v1 grammar. */
export function isValidKajayPattern(source: string): boolean {
  if (!hasAtMostScalars(source, MAX_SOURCE_SCALARS)) {
    return false;
  }
  const parser = new PatternSyntaxParser(source);
  return parser.parse();
}

class PatternSyntaxParser {
  readonly #source: string;
  #index = 0;
  #valid = true;

  constructor(source: string) {
    this.#source = source;
  }

  parse(): boolean {
    const states = this.#alternation();
    return this.#valid && this.#index === this.#source.length && states <= MAX_COMPILED_STATES;
  }

  #alternation(terminator?: string): number {
    let states = this.#sequence(terminator);
    while (this.#peek() === '|') {
      this.#index += 1;
      states = this.#boundedAdd(states, this.#sequence(terminator), 2);
    }
    return states;
  }

  #sequence(terminator?: string): number {
    let states = 0;
    while (this.#index < this.#source.length) {
      const current = this.#peek();
      if (current === '|' || current === terminator) {
        break;
      }
      states = this.#boundedAdd(states, this.#atom());
    }
    return states;
  }

  #atom(): number {
    const current = this.#take();
    let states = 1;
    let quantifiable = true;
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
      case '$':
        quantifiable = false;
        break;
      case '(':
        if (this.#peek() === '?') {
          return this.#fail();
        }
        states = this.#alternation(')');
        if (this.#take() !== ')') {
          return this.#fail();
        }
        states = this.#boundedAdd(states, 2);
        break;
      case '[':
        states = this.#characterClass();
        break;
      case '\\':
        if (!this.#escape()) {
          return this.#fail();
        }
        break;
      case '.':
        break;
      default:
        if (!this.#validScalarAt(current)) {
          return this.#fail();
        }
        break;
    }
    return quantifiable ? this.#quantifier(states) : states;
  }

  #characterClass(): number {
    if (this.#peek() === '^') {
      this.#index += 1;
    }
    let hasItem = false;
    while (this.#index < this.#source.length && this.#peek() !== ']') {
      const rangeStart = this.#classItem();
      if (rangeStart === undefined) {
        return this.#fail();
      }
      hasItem = true;
      if (this.#peek() === '-') {
        this.#index += 1;
        const rangeEnd = this.#classItem();
        if (rangeStart < 0 || rangeEnd === undefined || rangeEnd < 0 || rangeEnd < rangeStart) {
          return this.#fail();
        }
      }
    }
    if (!hasItem || this.#take() !== ']') {
      return this.#fail();
    }
    return 1;
  }

  #classItem(): number | undefined {
    const current = this.#take();
    if (current === undefined || current === ']' || current === '-') {
      return undefined;
    }
    if (current === '\\') {
      const escaped = this.#peek();
      if (!this.#escape()) {
        return undefined;
      }
      return escaped !== undefined && SHORTHAND_ESCAPES.has(escaped) ? -1 : escaped?.codePointAt(0);
    }
    return this.#validScalarAt(current) ? current.codePointAt(0) : undefined;
  }

  #escape(): boolean {
    const escaped = this.#take();
    if (escaped === undefined) {
      return false;
    }
    if (SHORTHAND_ESCAPES.has(escaped)) {
      return true;
    }
    if (/^[A-Za-z0-9]$/u.test(escaped)) {
      return false;
    }
    return true;
  }

  #quantifier(states: number): number {
    const current = this.#peek();
    if (current === '*' || current === '+' || current === '?') {
      this.#index += 1;
      return this.#boundedAdd(states, 2);
    }
    if (current !== '{') {
      return states;
    }
    this.#index += 1;
    const minimum = this.#decimal();
    if (minimum === undefined) {
      return this.#fail();
    }
    let maximum: number | undefined = minimum;
    if (this.#peek() === ',') {
      this.#index += 1;
      maximum = this.#decimal();
    }
    if (maximum === undefined || this.#take() !== '}' || maximum < minimum || maximum > MAX_REPETITION) {
      return this.#fail();
    }
    return this.#boundedMultiply(states, maximum, maximum - minimum);
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

  #validScalarAt(value: string): boolean {
    const point = value.codePointAt(0);
    return point !== undefined && (point < 0xd800 || point > 0xdfff);
  }

  #boundedAdd(...values: readonly number[]): number {
    const total = values.reduce((sum, value) => sum + value, 0);
    return total > MAX_COMPILED_STATES ? this.#fail() : total;
  }

  #boundedMultiply(states: number, count: number, extra: number): number {
    const total = states * count + extra;
    return total > MAX_COMPILED_STATES ? this.#fail() : total;
  }

  #fail(): number {
    this.#valid = false;
    return MAX_COMPILED_STATES + 1;
  }
}

function hasAtMostScalars(value: string, maximum: number): boolean {
  let count = 0;
  for (const scalar of value) {
    count += Math.min(scalar.length, 1);
    if (count > maximum) {
      return false;
    }
  }
  return true;
}
