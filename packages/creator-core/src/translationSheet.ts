import { localizedTextIn } from './propertyGrid.js';
import type { TranslationEntry } from './translations.js';

/**
 * A translation table as a spreadsheet — checklist M4's import/export.
 *
 * **Rows first, CSV second, and that split is the XLSX seam.** A sheet is a rectangle of
 * strings; CSV is one way to write one down and XLSX is another, and the second needs a
 * binary format library that a core package may not carry (the architecture check would
 * refuse it, and it would be right to). So the library produces and consumes the
 * *rectangle*, ships the CSV codec because that is thirty lines of string handling, and a
 * host that wants XLSX hands {@link translationRows} to whichever library they already
 * have. That is the whole of the seam, and it is smaller than an interface would be.
 */

/** The first two columns, before the languages. */
const KEY_COLUMN = 'key';
const CONTEXT_COLUMN = 'context';

/**
 * The table as a rectangle of strings, header row first.
 *
 * The **key column is the identity** and the context column is for the human doing the
 * translating — it is written out and ignored on the way back in, because it is derived
 * from titles that the translator may be in the middle of changing.
 */
export function translationRows(
  entries: readonly TranslationEntry[],
  locales: readonly string[],
): readonly (readonly string[])[] {
  const header = [KEY_COLUMN, CONTEXT_COLUMN, ...locales];
  const rows = entries.map((entry) => [
    entry.key,
    entry.context,
    ...locales.map((locale) => localizedTextIn(entry.value, locale)),
  ]);
  return [header, ...rows];
}

/** One cell of an imported sheet: which string, which language, what it now says. */
export interface TranslationCell {
  readonly key: string;
  readonly locale: string;
  readonly text: string;
}

/**
 * Reads a sheet back into cells.
 *
 * **Columns are matched by their header, not by their position**, so a translator who
 * added a language, removed one, or moved them around still sends back something usable —
 * which is most of what actually happens to a file once it leaves the building. A sheet
 * with no `key` column is refused outright rather than half-read: without it there is
 * nothing to match, and guessing the first column would silently write every translation
 * onto the wrong string.
 *
 * The context column is skipped on the way in. It is derived, and a translator who edited
 * it meant nothing by it.
 */
export function translationCells(
  rows: readonly (readonly string[])[],
): readonly TranslationCell[] {
  const header = rows[0];
  if (header === undefined) {
    return [];
  }
  const keyAt = header.indexOf(KEY_COLUMN);
  if (keyAt < 0) {
    return [];
  }
  const cells: TranslationCell[] = [];
  for (const row of rows.slice(1)) {
    const key = row[keyAt];
    if (key === undefined || key.length === 0) {
      continue;
    }
    for (const [index, locale] of header.entries()) {
      if (index !== keyAt && locale !== CONTEXT_COLUMN && locale.length > 0) {
        cells.push({ key, locale, text: row[index] ?? '' });
      }
    }
  }
  return cells;
}

/**
 * The rectangle as CSV, to RFC 4180.
 *
 * A field is quoted when it holds a comma, a quote or a line break, and a quote inside one
 * is doubled. Quoting *only* when needed rather than always, so a file a person opens in a
 * text editor reads as the table it is.
 */
export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map((cell) => csvField(cell)).join(',')).join('\r\n');
}

function csvField(cell: string): string {
  if (!/[",\r\n]/u.test(cell)) {
    return cell;
  }
  return `"${cell.replaceAll('"', '""')}"`;
}

/**
 * CSV back into a rectangle.
 *
 * A character-at-a-time reader rather than a split on commas, because a survey title with
 * a comma in it is not unusual and neither is one with a line break — and a splitter gets
 * both wrong in a way that looks like it worked. `\r\n`, `\n` and a lone `\r` all end a
 * row; inside quotes none of them do.
 */
export function fromCsv(text: string): readonly (readonly string[])[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index] ?? '';
    if (quoted) {
      if (character !== '"') {
        field += character;
      } else if (text[index + 1] === '"') {
        // A doubled quote is one quote, and the second one is not a closing quote.
        field += '"';
        index += 1;
      } else {
        quoted = false;
      }
      continue;
    }
    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      index += character === '\r' && text[index + 1] === '\n' ? 1 : 0;
    } else {
      field += character;
    }
  }
  // A file ending in a newline has no trailing empty row; one ending mid-row has that row.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
