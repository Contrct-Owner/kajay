import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface, JsonEditorSession, locationOf, syntaxErrorOffset } from '@kajay/creator-core';
import { afterEach, describe, expect, test } from 'vitest';

/** The definition as text — checklist M2. */
const BASIC: SurveyDefinition = {
  pages: [{ name: 'p1', elements: [{ type: 'text', name: 'who', title: 'Your name' }] }],
};

const open: JsonEditorSession[] = [];

function surface(definition: SurveyDefinition = BASIC): DesignSurface {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return new DesignSurface({ definition, registry });
}

function session(designed: DesignSurface): JsonEditorSession {
  const editor = new JsonEditorSession(designed);
  open.push(editor);
  return editor;
}

afterEach(() => {
  for (const editor of open.splice(0)) {
    editor.dispose();
  }
});

describe('parity/M2-json-sync', () => {
  test('it opens on what the designer has, formatted', () => {
    const editor = session(surface());

    expect(JSON.parse(editor.text)).toEqual(surface().definition);
    expect(editor.text).toContain('\n  ');
    expect(editor.isDirty).toBe(false);
  });

  test('a clean draft follows the designer', () => {
    const designed = surface();
    const editor = session(designed);

    designed.setProperty(designed.survey.getQuestionByName('who')!, 'title', 'Name');

    // Nothing typed, nothing lost — M3 drew this line for the preview and it is the same
    // line here.
    expect(editor.text).toContain('"title": "Name"');
    expect(editor.isDirty).toBe(false);
    expect(editor.isStale).toBe(false);
  });

  test('a dirty draft is never overwritten, and says the designer moved', () => {
    const designed = surface();
    const editor = session(designed);
    editor.setText('{"pages":[]}');

    designed.setProperty(designed.survey.getQuestionByName('who')!, 'title', 'Name');

    // Overwriting here would be the Creator deleting somebody's typing.
    expect(editor.text).toBe('{"pages":[]}');
    expect(editor.isDirty).toBe(true);
    expect(editor.isStale).toBe(true);
  });

  test('typing alone is not a conflict', () => {
    const editor = session(surface());

    editor.setText('{"pages":[]}');

    // Staleness is the draft against *what it was seeded from*, not against the draft
    // itself — otherwise the "you both changed it" notice would appear on the first
    // keystroke of every edit, which is exactly when nobody else has changed anything.
    expect(editor.isDirty).toBe(true);
    expect(editor.isStale).toBe(false);
  });

  test('a clean draft cannot be stale, because it follows', () => {
    const designed = surface();
    const editor = session(designed);

    designed.addPage();

    expect(editor.isStale).toBe(false);
  });

  test('applying reaches the designer, and is undoable', () => {
    const designed = surface();
    const editor = session(designed);

    editor.setText('{"pages":[{"name":"p1","elements":[{"type":"comment","name":"notes"}]}]}');
    expect(editor.apply()).toBe(true);

    expect(designed.survey.getQuestionByName('notes')?.type).toBe('comment');
    // Hand-editing the whole survey in a keystroke is exactly where undo matters most,
    // and it costs nothing: `applyEdit` is the same seam a drag goes through.
    designed.undo();
    expect(designed.survey.getQuestionByName('who')?.type).toBe('text');
  });

  test('applying re-seeds from what survived, not from what was typed', () => {
    const designed = surface();
    const editor = session(designed);

    // `startWithNewLine: false` is the registered default, which canonical form elides.
    editor.setText('{"pages":[{"name":"p1","elements":[{"type":"text","name":"who","startWithNewLine":false}]}]}');
    editor.apply();

    // Calling the draft clean without re-seeding would leave the editor showing something
    // the survey no longer says.
    expect(editor.isDirty).toBe(false);
    expect(editor.text).not.toContain('startWithNewLine');
  });

  test('reverting throws the draft away', () => {
    const designed = surface();
    const editor = session(designed);
    editor.setText('nonsense');

    editor.revert();

    expect(editor.isDirty).toBe(false);
    expect(editor.problem).toBeUndefined();
  });
});

describe('parity/M2-json-errors', () => {
  test('a syntax error is reported with a line and a column', () => {
    const editor = session(surface());

    editor.setText('{\n"pages":[]\n"x":1\n}');

    const problem = editor.problem;
    expect(problem?.kind).toBe('syntax');
    expect(problem?.at).toEqual({ line: 3, column: 1, offset: 13 });
    expect(editor.canApply).toBe(false);
  });

  test('a syntax error that reports no position still reports the problem', () => {
    const editor = session(surface());

    // Not hypothetical, and the reason the location is optional: one V8 version produces
    // *two* message formats, and `Unexpected token ',', "…" is not valid JSON` carries no
    // position at all. Inventing a line here would send a designer to look at the wrong
    // one, which is worse than sending them to look at the whole document.
    editor.setText('{\n  "pages": [,\n}');

    expect(editor.problem?.kind).toBe('syntax');
    expect(editor.problem?.at).toBeUndefined();
    expect(editor.problem?.message.length).toBeGreaterThan(0);
    expect(editor.canApply).toBe(false);
  });

  test('a value that is not a survey is rejected rather than parsed', () => {
    const editor = session(surface());

    editor.setText('[1, 2, 3]');

    // `parseSurvey` throws for a root that is not an object. It has no place in the text
    // to point at, so none is invented.
    expect(editor.problem?.kind).toBe('rejected');
    expect(editor.problem?.at).toBeUndefined();
    expect(editor.canApply).toBe(false);
  });

  test('applying is refused while there is no definition to apply', () => {
    const designed = surface();
    const editor = session(designed);
    editor.setText('{');

    expect(editor.apply()).toBe(false);
    expect(designed.survey.getQuestionByName('who')).toBeDefined();
  });

  test('a diagnostic is surfaced and does not block', () => {
    const designed = surface();
    const editor = session(designed);

    editor.setText('{"pages":[{"name":"p1","elements":[{"type":"text","name":"who","nonsense":1}]}]}');

    // `parseSurvey` is total: it keeps what it does not understand (ADR-0002 rule 3) and
    // reports. Refusing here would make this tab stricter than the file the host loaded.
    expect(editor.diagnostics.map((diagnostic) => diagnostic.code)).toContain('unknown-property');
    expect(editor.canApply).toBe(true);
    expect(editor.apply()).toBe(true);
    expect(designed.definition['pages']).toBeDefined();
  });

  test('a diagnostic carries the pointer at the offending node', () => {
    const editor = session(surface());

    editor.setText('{"pages":[{"name":"p1","elements":[{"type":"text","name":"who","title":5}]}]}');

    const found = editor.diagnostics.find((diagnostic) => diagnostic.severity === 'error');
    expect(found?.code).toBe('property-type-mismatch');
    expect(found?.path).toContain('/pages/0/elements/0');
  });

  test('text that will not parse has no diagnostics to report', () => {
    const editor = session(surface());

    editor.setText('{');

    expect(editor.diagnostics).toEqual([]);
  });
});

describe('parity/M2-json-location', () => {
  test('a position is read out of the message, and only when it is there', () => {
    expect(syntaxErrorOffset('Unexpected token } in JSON at position 42')).toBe(42);
    expect(
      syntaxErrorOffset("Expected ',' after value in JSON at position 7 (line 2 column 3)"),
    ).toBe(7);
    // The message is not a contract, and V8 has reworded it more than once. Nothing is
    // guessed when the one stable part is absent.
    expect(syntaxErrorOffset('Unexpected end of JSON input')).toBeUndefined();
  });

  test('a line and a column are counted from the text, not trusted from the message', () => {
    expect(locationOf('a\nbc\nd', 0)).toEqual({ line: 1, column: 1, offset: 0 });
    expect(locationOf('a\nbc\nd', 3)).toEqual({ line: 2, column: 2, offset: 3 });
    expect(locationOf('a\nbc\nd', 5)).toEqual({ line: 3, column: 1, offset: 5 });
  });

  test('an offset past the end lands at the end, which is where it ran out', () => {
    // An unterminated object is not an objection to something the parser saw.
    expect(locationOf('{\n', 99)).toEqual({ line: 2, column: 1, offset: 2 });
    expect(locationOf('abc', -5)).toEqual({ line: 1, column: 1, offset: 0 });
  });
});
