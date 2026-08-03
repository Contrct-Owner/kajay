import { FileQuestion, parseSurvey, SignatureQuestion } from '@kajay/core';
import type { FileEntry, FileUploadRequest, Survey } from '@kajay/core';
import { describe, expect, test } from 'vitest';
import { createTestRegistry } from '../support/createTestRegistry.js';

/** What an adapter hands the model once it has read a real file. */
function entry(overrides: Partial<FileEntry> = {}): FileEntry {
  return {
    name: 'receipt.pdf',
    type: 'application/pdf',
    size: 1024,
    content: 'data:application/pdf;base64,AAAA',
    ...overrides,
  };
}

function build(
  overrides: Readonly<Record<string, unknown>> = {},
  options: Readonly<Record<string, unknown>> = {},
): Survey {
  return parseSurvey(
    {
      pages: [
        {
          name: 'p1',
          elements: [{ type: 'file', name: 'receipt', title: 'Your receipt', ...overrides }],
        },
      ],
    },
    createTestRegistry(),
    options,
  ).survey;
}

function file(survey: Survey): FileQuestion {
  const question = survey.getQuestionByName('receipt');
  if (!(question instanceof FileQuestion)) {
    throw new TypeError('expected a file question');
  }
  return question;
}

function errorsOf(survey: Survey): readonly string[] {
  survey.validation.validateCurrentPage();
  return (survey.getQuestionByName('receipt')?.errors ?? []).map((error) => error.text);
}

function signature(survey: Survey): SignatureQuestion {
  const question = survey.getQuestionByName('sign');
  if (!(question instanceof SignatureQuestion)) {
    throw new TypeError('expected a signature question');
  }
  return question;
}

function buildSignature(overrides: Readonly<Record<string, unknown>> = {}): Survey {
  return parseSurvey(
    {
      pages: [
        {
          name: 'p1',
          elements: [{ type: 'signaturepad', name: 'sign', title: 'Sign here', ...overrides }],
        },
      ],
    },
    createTestRegistry(),
  ).survey;
}

describe('parity/H1-file', () => {
  test('the answer is always an array, even for a single file', async () => {
    const survey = build({ storeDataAsText: true });
    await file(survey).addFiles([entry()]);

    // A question that changed the *shape* of its answer when `allowMultiple` flipped
    // would break every host reading it.
    expect(survey.data).toEqual({
      receipt: [
        { name: 'receipt.pdf', type: 'application/pdf', size: 1024, content: expect.any(String) },
      ],
    });
  });

  test('a single-file question keeps the last file, not the first', async () => {
    const survey = build({ storeDataAsText: true });
    await file(survey).addFiles([entry()]);
    await file(survey).addFiles([entry({ name: 'better.pdf' })]);

    expect(file(survey).files.map((held) => held.name)).toEqual(['better.pdf']);
  });

  test('a multiple-file question accumulates', async () => {
    const survey = build({ allowMultiple: true, storeDataAsText: true });
    await file(survey).addFiles([entry()]);
    await file(survey).addFiles([entry({ name: 'second.pdf' })]);

    expect(file(survey).files.map((held) => held.name)).toEqual(['receipt.pdf', 'second.pdf']);
  });

  test('without storeDataAsText the content stays out of the response', async () => {
    const survey = build();
    await file(survey).addFiles([entry()]);

    // The description is kept — enough to show what was attached and to check it — but
    // a response is not a place to put a photograph nobody asked to store there.
    expect(file(survey).files[0]?.content).toBeUndefined();
    expect(file(survey).files[0]?.name).toBe('receipt.pdf');
  });

  test('removing a file empties the answer rather than leaving an empty list', async () => {
    const survey = build({ storeDataAsText: true });
    await file(survey).addFiles([entry()]);
    file(survey).removeFile('receipt.pdf');

    expect(survey.data).toEqual({});
  });
});

describe('parity/H1-file-rules', () => {
  test('an accepted-types list is enforced, not just offered to the picker', async () => {
    const survey = build({ acceptedTypes: 'image/*,.pdf' });
    await file(survey).addFiles([entry({ name: 'notes.txt', type: 'text/plain' })]);

    // A respondent can drag a file past `accept`. The rule holds here or nowhere.
    expect(errorsOf(survey)).toEqual([
      '"notes.txt" is not one of the accepted file types (image/*,.pdf).',
    ]);
  });

  test('a wildcard matches its family and an extension matches the name', async () => {
    const survey = build({ allowMultiple: true, acceptedTypes: 'image/*,.pdf' });
    await file(survey).addFiles([
      entry({ name: 'photo.png', type: 'image/png' }),
      entry({ name: 'scan.PDF', type: '' }),
    ]);

    // The extension case is the one that matters in practice: a platform that will not
    // name a type still names the file.
    expect(errorsOf(survey)).toEqual([]);
  });

  test('a file over the size limit is refused, in units a respondent reads', async () => {
    const survey = build({ maxSize: 1_048_576 });
    await file(survey).addFiles([entry({ size: 3_000_000 })]);

    expect(errorsOf(survey)).toEqual(['"receipt.pdf" is larger than 1.0 MB.']);
  });

  test('too many files is one message about the question, not one per file', async () => {
    const survey = build({ allowMultiple: true, maxFileCount: 2 });
    await file(survey).addFiles([
      entry({ name: 'a.pdf' }),
      entry({ name: 'b.pdf' }),
      entry({ name: 'c.pdf' }),
    ]);

    expect(errorsOf(survey)).toEqual(['Please attach no more than 2 files.']);
  });
});

describe('parity/H1-upload-seam', () => {
  test('an uploader stores the file and the answer keeps what came back', async () => {
    const asked: FileUploadRequest[] = [];
    const survey = build(
      {},
      {
        uploadFiles: async (request: FileUploadRequest) => {
          asked.push(request);
          await Promise.resolve();
          return request.files.map((held) => ({
            name: held.name,
            type: held.type,
            size: held.size,
            url: `https://files.example.com/${held.name}`,
          }));
        },
      },
    );
    await file(survey).addFiles([entry()]);

    expect(asked[0]?.questionName).toBe('receipt');
    expect(file(survey).files[0]?.url).toBe('https://files.example.com/receipt.pdf');
    // The content went to the host and did not also stay in the response.
    expect(file(survey).files[0]?.content).toBeUndefined();
  });

  test('a failed upload leaves the previous files alone and says why', async () => {
    const survey = build(
      { allowMultiple: true },
      { uploadFiles: () => Promise.reject(new Error('the bucket is full')) },
    );
    await file(survey).addFiles([entry()]);

    // Recording a reference to something that was never stored is the one outcome that
    // must not happen: it looks like success to everybody downstream.
    expect(survey.data).toEqual({});
    expect(file(survey).uploadFailure).toBe('the bucket is full');
    expect(file(survey).isUploading).toBe(false);
  });

  test('the uploading flag comes down however the upload ends', async () => {
    const survey = build({}, { uploadFiles: () => Promise.reject(new Error('no')) });
    const question = file(survey);
    const pending = question.addFiles([entry()]);
    expect(question.isUploading).toBe(true);

    await pending;
    expect(question.isUploading).toBe(false);
  });
});

describe('parity/H3-file-seams', () => {
  test('clearing a file tells the host, so it can delete its copy', async () => {
    const cleared: string[] = [];
    const survey = build(
      { storeDataAsText: true },
      {
        clearFiles: (request: FileUploadRequest) => {
          cleared.push(...request.files.map((held) => held.name));
          return Promise.resolve();
        },
      },
    );
    await file(survey).addFiles([entry()]);
    file(survey).removeFile('receipt.pdf');

    expect(cleared).toEqual(['receipt.pdf']);
  });

  test('a host that cannot delete its copy does not stop the respondent', async () => {
    const survey = build(
      { storeDataAsText: true },
      { clearFiles: () => Promise.reject(new Error('permission denied')) },
    );
    await file(survey).addFiles([entry()]);
    file(survey).clearFiles();

    // Housekeeping. Refusing to let them detach the file would make it theirs.
    expect(survey.data).toEqual({});
  });

  test('a download seam mints the URL, and its absence falls back to what is held', async () => {
    const plain = build({ storeDataAsText: true });
    await plain.getQuestionByName('receipt')?.value;
    await file(plain).addFiles([entry()]);
    await expect(file(plain).resolveUrl(entry())).resolves.toBe(
      'data:application/pdf;base64,AAAA',
    );

    const signed = build(
      {},
      { downloadFile: (held: FileEntry) => Promise.resolve(`https://signed/${held.name}?token=1`) },
    );
    await expect(file(signed).resolveUrl(entry())).resolves.toBe(
      'https://signed/receipt.pdf?token=1',
    );
  });
});

describe('parity/H2-signature', () => {
  test('the answer is a data URL and travels like any other string', () => {
    const survey = buildSignature();
    signature(survey).setSignature('data:image/png;base64,AAAA');

    expect(survey.data).toEqual({ sign: 'data:image/png;base64,AAAA' });
  });

  test('signing and then erasing is not an answer', () => {
    const survey = buildSignature({ isRequired: true });
    signature(survey).setSignature('data:image/png;base64,AAAA');
    signature(survey).setSignature('');

    expect(survey.data).toEqual({});
    survey.validation.validateCurrentPage();
    expect(survey.getQuestionByName('sign')?.hasErrors).toBe(true);
  });

  test('the definition decides the ink, the paper and the output', () => {
    const survey = buildSignature({
      penColor: '#ff0000',
      backgroundColor: '#eeeeee',
      signatureFormat: 'jpeg',
    });

    expect(signature(survey).penColor).toBe('#ff0000');
    expect(signature(survey).backgroundColor).toBe('#eeeeee');
    expect(signature(survey).signatureFormat).toBe('jpeg');
  });

  test('an unrecognised format falls back to png rather than to nothing', () => {
    expect(signature(buildSignature({ signatureFormat: 'tiff' })).signatureFormat).toBe('png');
  });
});
