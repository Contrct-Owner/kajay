import { ThemeEditorSession } from '@kajay/creator-core';
import type { ThemeDocument } from '@kajay/creator-core';
import {
  BUILT_IN_THEME_FIELDS,
  themeRowsFor,
  valueAt,
  withValueAt,
} from '../../src/themeFields.js';
import { describe, expect, test } from 'vitest';

/**
 * The theme editor — checklist M5.
 *
 * A theme is the plain JSON it always was: nothing here imports `@kajay/themes`, which
 * `creator-core` may not depend on and does not need to.
 */
const BASIC: ThemeDocument = {
  name: 'demo',
  palette: { accent: '#3355ff', text: '#111111' },
  size: 'regular',
};

function rowFor(session: ThemeEditorSession, path: string) {
  return session.rows.find((row) => row.path === path);
}

describe('parity/M5-theme-fields', () => {
  test('the shipped format is described, and drawn in the order a designer works', () => {
    const rows = themeRowsFor(BASIC);

    expect(rows[0]?.path).toBe('palette.background');
    expect(rowFor(new ThemeEditorSession({ theme: BASIC }), 'palette.accent')?.kind).toBe('color');
    expect(rowFor(new ThemeEditorSession({ theme: BASIC }), 'size')?.choices).toEqual([
      'compact',
      'regular',
      'roomy',
    ]);
  });

  test('a label is derived from the last segment of the path', () => {
    const rows = themeRowsFor(BASIC);

    // L1's rule, and for its reasons: a table of human names would be missing an entry the
    // day a field arrived.
    expect(rows.find((row) => row.path === 'palette.onAccent')?.title).toBe('On accent');
    expect(rows.find((row) => row.path === 'cornerRadius')?.title).toBe('Corner radius');
  });

  test('a key the table has never heard of still appears', () => {
    const rows = themeRowsFor({ palette: { highlight: '#ff0' }, spacingScale: 2 });

    // `builtInToolbox`'s courtesy, one more time: a host's own theme format is not
    // second-class.
    expect(rows.find((row) => row.path === 'palette.highlight')?.text).toBe('#ff0');
    // The kind is inferred from what the value *is*, because nothing declared it.
    expect(rows.find((row) => row.path === 'spacingScale')?.kind).toBe('number');
  });

  test('the name and the escape hatch are not rows', () => {
    const paths = themeRowsFor({ name: 'demo', variables: { '--x': '1px' } }).map(
      (row) => row.path,
    );

    // One identifies the theme rather than describing it; the other is raw CSS custom
    // properties, which is a JSON field and not a grid row.
    expect(paths).not.toContain('name');
    expect(paths.some((path) => path.startsWith('variables'))).toBe(false);
  });

  test('a host may describe their own format instead', () => {
    const rows = themeRowsFor({ brand: 'acme' }, [{ path: 'brand', kind: 'text' }]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.text).toBe('acme');
  });

  test('what the theme does not name is marked as such', () => {
    const session = new ThemeEditorSession({ theme: BASIC });

    // A different answer from "empty", and the reason it is on the row at all: an absent
    // field leaves the stylesheet's own default alone (I2).
    expect(rowFor(session, 'palette.accent')?.isSet).toBe(true);
    expect(rowFor(session, 'cornerRadius')?.isSet).toBe(false);
    expect(rowFor(session, 'cornerRadius')?.text).toBe('');
  });
});

describe('parity/M5-theme-paths', () => {
  test('a value is read and written at a dotted path', () => {
    expect(valueAt(BASIC, 'palette.accent')).toBe('#3355ff');
    expect(valueAt(withValueAt(BASIC, 'palette.accent', '#000'), 'palette.accent')).toBe('#000');
    expect(valueAt(withValueAt(BASIC, 'backdrop.opacity', 0.5), 'backdrop.opacity')).toBe(0.5);
  });

  test('an empty value removes the key rather than blanking it', () => {
    const after = withValueAt(BASIC, 'size', '');

    // A blanked `size` would reach the renderer as an empty CSS variable and override the
    // stylesheet's own default with nothing.
    expect('size' in after).toBe(false);
  });

  test('a branch left empty by a removal goes with it', () => {
    const withBackdrop = withValueAt(BASIC, 'backdrop.image', 'a.png');

    const after = withValueAt(withBackdrop, 'backdrop.image', '');

    // Otherwise exporting would carry `"backdrop": {}` around forever.
    expect('backdrop' in after).toBe(false);
  });

  test('writing into a branch that is not an object replaces it rather than merging', () => {
    const after = withValueAt({ palette: 'nonsense' }, 'palette.accent', '#000');

    expect(valueAt(after, 'palette.accent')).toBe('#000');
    // Spreading a string would give the branch a key per character, which is a theme
    // holding `{ "0": "n", "1": "o", … }` and setting a variable for each of them.
    expect(Object.keys(after['palette'] as object)).toEqual(['accent']);
  });

  test('the original document is never touched', () => {
    withValueAt(BASIC, 'palette.accent', '#000');

    expect(valueAt(BASIC, 'palette.accent')).toBe('#3355ff');
  });
});

describe('parity/M5-theme-editing', () => {
  test('setting a field changes the theme and announces it', () => {
    const session = new ThemeEditorSession({ theme: BASIC });
    let announced = 0;
    session.onChanged.add(() => {
      announced += 1;
    });

    session.setValue('cornerRadius', '12px');

    expect(valueAt(session.theme, 'cornerRadius')).toBe('12px');
    expect(announced).toBe(1);
    expect(session.isDirty).toBe(true);
  });

  test('setting a field to what it already says changes nothing', () => {
    const session = new ThemeEditorSession({ theme: BASIC });
    let announced = 0;
    session.onChanged.add(() => {
      announced += 1;
    });

    session.setValue('palette.accent', '#3355ff');

    expect(announced).toBe(0);
    expect(session.isDirty).toBe(false);
  });

  test('a number field stores a number, not the text of one', () => {
    const session = new ThemeEditorSession({ theme: BASIC });

    session.setValue('backdrop.opacity', '0.4');

    expect(valueAt(session.theme, 'backdrop.opacity')).toBe(0.4);
  });

  test('a half-typed number is not written', () => {
    const session = new ThemeEditorSession({ theme: BASIC });
    session.setValue('backdrop.opacity', '0.4');

    session.setValue('backdrop.opacity', 'not a number');

    expect(valueAt(session.theme, 'backdrop.opacity')).toBeUndefined();
  });

  test('applying a preset replaces rather than merges', () => {
    const session = new ThemeEditorSession({ theme: BASIC });

    session.applyTheme({ name: 'dark', palette: { text: '#eeeeee' } });

    // I3's finding in a different place: a preset merged over the current theme inherits
    // whatever the last one set, which is exactly how switching leaves one wrong colour
    // behind.
    expect(valueAt(session.theme, 'palette.accent')).toBeUndefined();
    expect(valueAt(session.theme, 'palette.text')).toBe('#eeeeee');
  });

  test('reset goes back to the theme the session opened with', () => {
    const session = new ThemeEditorSession({ theme: BASIC });
    session.setValue('cornerRadius', '12px');

    session.reset();

    expect(session.theme).toEqual(BASIC);
    expect(session.isDirty).toBe(false);
  });
});

describe('parity/M5-theme-file', () => {
  test('a theme goes out as formatted JSON and comes back unchanged', () => {
    const session = new ThemeEditorSession({ theme: BASIC });

    const json = session.toJson();
    session.setValue('cornerRadius', '12px');
    expect(session.applyJson(json)).toBe(true);

    expect(session.theme).toEqual(BASIC);
    expect(json).toContain('\n  ');
  });

  test('a file that will not parse is reported with a line and a column', () => {
    const session = new ThemeEditorSession({ theme: BASIC });

    expect(session.applyJson('{\n"a":1\n"b":2\n}')).toBe(false);

    expect(session.problem?.at?.line).toBe(3);
    // The theme is untouched: a file somebody picked by mistake must not blank a survey.
    expect(session.theme).toEqual(BASIC);
  });

  test('a file that is not an object is refused', () => {
    const session = new ThemeEditorSession({ theme: BASIC });

    expect(session.applyJson('[1, 2, 3]')).toBe(false);

    expect(session.problem?.message).toBe('A theme must be a JSON object.');
    expect(session.problem?.at).toBeUndefined();
  });

  test('the next thing that works clears the complaint', () => {
    const session = new ThemeEditorSession({ theme: BASIC });
    session.applyJson('nonsense');

    session.applyJson('{"name":"other"}');

    expect(session.problem).toBeUndefined();
  });

  test('the shipped field table describes the format and nothing else', () => {
    // A guard on the table itself: every field names a path and a kind, and a `choice`
    // says what it offers — a choice with no choices is a select with nothing in it.
    for (const field of BUILT_IN_THEME_FIELDS) {
      expect(field.path.length).toBeGreaterThan(0);
      if (field.kind === 'choice') {
        expect(field.choices?.length).toBeGreaterThan(0);
      }
    }
  });
});
