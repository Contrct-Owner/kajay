import { readFileSync } from 'node:fs';

/**
 * Removes `//` and block comments while respecting string literals, so a `//` inside a
 * path value is not mistaken for a comment.
 */
export function stripJsonComments(source) {
  let out = '';
  let state = 'code';

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (state === 'line') {
      if (char === '\n') {
        state = 'code';
        out += char;
      }
    } else if (state === 'block') {
      if (char === '*' && next === '/') {
        state = 'code';
        i += 1;
      }
    } else if (state === 'escape') {
      out += char;
      state = 'string';
    } else if (state === 'string') {
      out += char;
      if (char === '\\') {
        state = 'escape';
      } else if (char === '"') {
        state = 'code';
      }
    } else if (char === '"') {
      state = 'string';
      out += char;
    } else if (char === '/' && next === '/') {
      state = 'line';
      i += 1;
    } else if (char === '/' && next === '*') {
      state = 'block';
      i += 1;
    } else {
      out += char;
    }
  }

  return out;
}

/** Reads a JSON file that may contain comments (tsconfig.json does). */
export function readJsonc(path) {
  return JSON.parse(stripJsonComments(readFileSync(path, 'utf8')));
}
