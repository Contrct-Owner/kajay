import {
  FileQuestion,
  MatrixDynamicQuestion,
  PanelDynamicQuestion,
  parseSurvey,
} from '@kajay/core';
import type { FilesChangedEvent, RecordsChangedEvent, Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';

/**
 * The events whose features had to exist first — checklist A7.
 *
 * `parseSurvey` without a private registry throughout, because the wiring under test is
 * installed by `parseSurvey` itself: a survey assembled by hand has no registry to build
 * instances from and would prove nothing about either event.
 */
function recorded(survey: Survey): RecordsChangedEvent[] {
  const events: RecordsChangedEvent[] = [];
  survey.onRecordsChanged.add((event) => events.push(event));
  return events;
}

function matrixSurvey(): Survey {
  return parseSurvey({
    pages: [
      {
        name: 'p1',
        elements: [
          {
            type: 'matrixdynamic',
            name: 'lines',
            rowCount: 1,
            columns: [{ type: 'text', name: 'what' }],
          },
        ],
      },
    ],
  }).survey;
}

function panelSurvey(): Survey {
  return parseSurvey({
    pages: [
      {
        name: 'p1',
        elements: [
          {
            type: 'paneldynamic',
            name: 'travellers',
            panelCount: 1,
            templateElements: [{ type: 'text', name: 'who' }],
          },
        ],
      },
    ],
  }).survey;
}

describe('parity/A7-records-changed', () => {
  test('a matrix row reports itself as it arrives and as it goes', () => {
    const survey = matrixSurvey();
    const matrix = survey.getQuestionByName('lines');
    if (!(matrix instanceof MatrixDynamicQuestion)) {
      throw new TypeError('The fixture must build a dynamic matrix.');
    }
    const events = recorded(survey);

    matrix.addRow();
    matrix.removeRow('1');

    expect(events).toEqual([
      { question: matrix, key: '1', change: 'added', count: 2 },
      { question: matrix, key: '1', change: 'removed', count: 1 },
    ]);
  });

  test('a repeating panel reports on the same channel', () => {
    const survey = panelSurvey();
    const panels = survey.getQuestionByName('travellers');
    if (!(panels instanceof PanelDynamicQuestion)) {
      throw new TypeError('The fixture must build a dynamic panel.');
    }
    const events = recorded(survey);

    panels.addPanel();

    // One event for both repeating types, because they are one thing: a host reacting
    // to rows almost always means instances too, and two channels is one of them
    // forgotten when a third repeating type arrives.
    expect(events).toEqual([{ question: panels, key: '1', change: 'added', count: 2 }]);
  });

  test('a repeating panel reports its removal too', () => {
    const survey = panelSurvey();
    const panels = survey.getQuestionByName('travellers');
    if (!(panels instanceof PanelDynamicQuestion)) {
      throw new TypeError('The fixture must build a dynamic panel.');
    }
    panels.addPanel();
    const events = recorded(survey);

    panels.removePanel('1');

    // Removal separately from addition: they are different lines in different methods,
    // and a mutation reverting either one is invisible to a test that only adds.
    expect(events).toEqual([{ question: panels, key: '1', change: 'removed', count: 1 }]);
  });

  test('the count is what there is now, not what there was', () => {
    const survey = matrixSurvey();
    const matrix = survey.getQuestionByName('lines');
    if (!(matrix instanceof MatrixDynamicQuestion)) {
      throw new TypeError('The fixture must build a dynamic matrix.');
    }
    const events = recorded(survey);

    matrix.addRow();
    matrix.addRow();

    expect(events.map((event) => event.count)).toEqual([2, 3]);
  });

  test('a refusal is not an event', () => {
    const survey = parseSurvey({
      pages: [
        {
          name: 'p1',
          elements: [
            {
              type: 'matrixdynamic',
              name: 'lines',
              rowCount: 1,
              maxRowCount: 1,
              columns: [{ type: 'text', name: 'what' }],
            },
          ],
        },
      ],
    }).survey;
    const matrix = survey.getQuestionByName('lines');
    if (!(matrix instanceof MatrixDynamicQuestion)) {
      throw new TypeError('The fixture must build a dynamic matrix.');
    }
    const events = recorded(survey);

    matrix.addRow();
    matrix.removeRow('nonsense');

    expect(events).toEqual([]);
  });

  test('switching language rebuilds without announcing a record', () => {
    const survey = matrixSurvey();
    const events = recorded(survey);

    // A locale switch throws every instance away and builds them again. Announcing a
    // row added because somebody switched to French is a lie a host acts on.
    survey.setLocale('fr');

    expect(events).toEqual([]);
  });
});

const RECEIPT = { name: 'receipt.txt', type: 'text/plain', size: 4, content: 'data:x' };

function fileSurvey(uploader?: () => Promise<never>): Survey {
  return parseSurvey(
    { pages: [{ name: 'p1', elements: [{ type: 'file', name: 'evidence', allowMultiple: true }] }] },
    uploader === undefined ? {} : { uploadFiles: uploader },
  ).survey;
}

function fileQuestion(survey: Survey): FileQuestion {
  const question = survey.getQuestionByName('evidence');
  if (!(question instanceof FileQuestion)) {
    throw new TypeError('The fixture must build a file question.');
  }
  return question;
}

describe('parity/A7-files-changed', () => {
  test('attaching and detaching each report what moved', async () => {
    const survey = fileSurvey();
    const events: FilesChangedEvent[] = [];
    survey.onFilesChanged.add((event) => events.push(event));
    const question = fileQuestion(survey);

    await question.addFiles([RECEIPT]);
    question.removeFile('receipt.txt');

    expect(events.map((event) => event.change)).toEqual(['attached', 'removed']);
    expect(events[0]?.files.map((file) => file.name)).toEqual(['receipt.txt']);
    expect(events[0]?.question).toBe(question);
  });

  test('a stored file reports what the host gave back, not what was handed over', async () => {
    const stored = { name: 'receipt.txt', type: 'text/plain', size: 4, url: 'https://store/1' };
    const survey = fileSurvey(() => Promise.resolve([stored]) as Promise<never>);
    const events: FilesChangedEvent[] = [];
    survey.onFilesChanged.add((event) => events.push(event));

    await fileQuestion(survey).addFiles([RECEIPT]);

    // The uploader's answer, not the entry that went in: the reference the host minted
    // is the thing anything downstream can actually use, and it is what landed in the
    // response. A separate path from the no-uploader case, and a separate line.
    expect(events).toEqual([
      { question: fileQuestion(survey), files: [stored], change: 'attached' },
    ]);
  });

  test('an upload that failed announces nothing', async () => {
    const survey = fileSurvey(() => Promise.reject(new Error('storage is down')));
    const events: FilesChangedEvent[] = [];
    survey.onFilesChanged.add((event) => events.push(event));

    await fileQuestion(survey).addFiles([RECEIPT]);

    // The answer did not change, so nothing changed. A listener told otherwise would
    // save a reference to a file the host never stored.
    expect(events).toEqual([]);
    expect(survey.getValue('evidence')).toBeUndefined();
  });
});
