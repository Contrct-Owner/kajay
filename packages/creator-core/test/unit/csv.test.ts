import { fromCsv, toCsv } from '../../src/translationSheet.js';
import { describe, expect, test } from 'vitest';

/**
 * The CSV codec — checklist M4's import/export.
 *
 * Its own file because it is its own subject: a rectangle of strings in and out, with no
 * survey anywhere near it. The translation table's use of it is tested next door.
 */
describe('parity/M4-csv', () => {
  test('a field is quoted only when it has to be', () => {
    expect(
      toCsv([
        ['a', 'b'],
        ['plain', 'has, comma'],
      ]),
    ).toBe('a,b\r\nplain,"has, comma"');
  });

  test('a quote inside a field is doubled', () => {
    expect(toCsv([['say "hi"']])).toBe('"say ""hi"""');
  });

  test('a comma, a quote and a line break all survive the round trip', () => {
    const rows = [
      ['key', 'default'],
      ['a', 'has, comma'],
      ['b', 'say "hi"'],
      ['c', 'line\nbreak'],
    ];

    expect(fromCsv(toCsv(rows))).toEqual(rows);
  });

  test('a splitter on commas would get this wrong, and this does not', () => {
    // A survey title with a comma in it is not unusual and neither is one with a line
    // break, and a splitter gets both wrong in a way that looks like it worked.
    expect(fromCsv('a,"b,c",d')).toEqual([['a', 'b,c', 'd']]);
    expect(fromCsv('a,"b\nc"')).toEqual([['a', 'b\nc']]);
  });

  test('every line ending ends a row, and none of them do inside quotes', () => {
    expect(fromCsv('a\r\nb\nc\rd')).toEqual([['a'], ['b'], ['c'], ['d']]);
    expect(fromCsv('"a\r\nb"')).toEqual([['a\r\nb']]);
  });

  test('a trailing newline is not an extra row', () => {
    expect(fromCsv('a,b\r\n')).toEqual([['a', 'b']]);
    expect(fromCsv('')).toEqual([]);
  });
});
