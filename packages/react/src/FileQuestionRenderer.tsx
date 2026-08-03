import { FileQuestion } from '@kajay/core';
import type { FileEntry } from '@kajay/core';
import { useState } from 'react';
import type { DragEvent, ReactElement } from 'react';
import type { QuestionRendererProps } from './QuestionRendererProps.js';
import { QuestionErrors } from './QuestionErrors.js';
import { questionErrorId, questionId } from './questionId.js';
import { QuestionTitleContent } from './QuestionTitleContent.js';
import { readFiles } from './readFiles.js';
import { whenEditable } from './readOnly.js';
import { useQuestionValue } from './useSurveyState.js';

/** Bytes as a respondent reads them, beside the name of the thing they attached. */
function describeSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.ceil(bytes / 1024).toString()} KB`;
}

/**
 * One attached file: what it is, a look at it, and a way to take it back off.
 *
 * The preview is drawn from whatever the entry carries — its own content, or the URL the
 * host stored it at — so it works before an upload and after one without knowing which
 * happened.
 */
function AttachedFile({
  question,
  entry,
  onRemove,
}: {
  readonly question: FileQuestion;
  readonly entry: FileEntry;
  readonly onRemove: () => void;
}): ReactElement {
  const source = entry.url ?? entry.content ?? '';
  const isImage = entry.type.startsWith('image/');
  return (
    <li className="kajay-file__item" data-file-name={entry.name}>
      {question.showPreview && isImage && source.length > 0 ? (
        <img className="kajay-file__preview" src={source} alt="" />
      ) : null}
      <span className="kajay-file__name">{entry.name}</span>
      <span className="kajay-file__size">{describeSize(entry.size)}</span>
      <button
        type="button"
        className="kajay-file__remove"
        onClick={whenEditable(question.isReadOnly, onRemove)}
      >
        {`Remove ${entry.name}`}
      </button>
    </li>
  );
}

interface DropZoneProps {
  readonly question: FileQuestion;
  readonly inputId: string;
  readonly errorId: string;
  readonly isOver: boolean;
  readonly setOver: (isOver: boolean) => void;
  readonly onFiles: (files: readonly File[]) => void;
}

/**
 * The picker, with a drop target around it.
 *
 * A real `input[type=file]` rather than a styled div that opens one: the input is what a
 * keyboard reaches, what a screen reader announces as a file control, and what a mobile
 * browser turns into a camera when asked. Dropping is an addition to it, never a
 * replacement — a drop zone alone is unusable without a pointer.
 */
function DropZone({
  question,
  inputId,
  errorId,
  isOver,
  setOver,
  onFiles,
}: DropZoneProps): ReactElement {
  const accept = question.acceptedTypes;
  return (
    <div
      className={isOver ? 'kajay-file__drop kajay-file__drop--over' : 'kajay-file__drop'}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => {
        setOver(false);
      }}
      onDrop={(event: DragEvent<HTMLDivElement>) => {
        // Guarded here rather than with `whenEditable`, which takes no event: the drop
        // still has to be cancelled or the browser navigates to the file.
        event.preventDefault();
        setOver(false);
        if (!question.isReadOnly) {
          onFiles([...event.dataTransfer.files]);
        }
      }}
    >
      <input
        id={inputId}
        className="kajay-file__input"
        type="file"
        multiple={question.allowMultiple}
        disabled={!question.isEnabled || question.isReadOnly}
        aria-invalid={question.hasErrors || undefined}
        aria-describedby={question.hasErrors ? errorId : undefined}
        {...(accept.length > 0 ? { accept } : {})}
        {...(question.allowCameraCapture ? { capture: 'environment' } : {})}
        onChange={(event) => {
          onFiles([...(event.target.files ?? [])]);
          // The picker keeps its selection otherwise, so choosing the same file twice in
          // a row would raise no change at all.
          event.target.value = '';
        }}
      />
    </div>
  );
}

/**
 * What the host's storage is doing, if anything.
 *
 * A failure is an alert because it arrives long after the respondent acted: they picked
 * a file, looked away, and the upload came back empty-handed.
 */
function UploadStatus({ question }: { readonly question: FileQuestion }): ReactElement | null {
  if (question.isUploading) {
    return <p className="kajay-file__uploading">Uploading…</p>;
  }
  if (question.uploadFailure === undefined) {
    return null;
  }
  return (
    <p className="kajay-file__failure" role="alert">
      {question.uploadFailure}
    </p>
  );
}

/**
 * A file attachment — checklist H1.
 *
 * A real `input[type=file]` with a drop zone around it, rather than a styled div that
 * opens a picker: the input is what a keyboard reaches, what a screen reader announces
 * as a file control, and what a mobile browser turns into a camera when asked. Dropping
 * is an addition to it, never a replacement.
 */
export function FileQuestionRenderer({ survey, question }: QuestionRendererProps): ReactElement {
  useQuestionValue(survey, question);
  const [isOver, setOver] = useState(false);

  if (!(question instanceof FileQuestion)) {
    return <div className="kajay-question kajay-question--unsupported" />;
  }

  const inputId = questionId(question);
  const errorId = questionErrorId(question);
  const attach = (files: readonly File[]): void => {
    // Nothing awaits it: reading and storing are asynchronous, and a change handler that
    // returned a promise would be one nobody handles. The model reports what happened.
    void readFiles(files).then((entries) => question.addFiles(entries));
  };

  return (
    <div className="kajay-question kajay-question--file" data-question-name={question.name}>
      <label className="kajay-question__title" htmlFor={inputId}>
        <QuestionTitleContent question={question} />
      </label>

      <QuestionErrors survey={survey} question={question} at="top" id={errorId} />

      <DropZone
        question={question}
        inputId={inputId}
        errorId={errorId}
        isOver={isOver}
        setOver={setOver}
        onFiles={attach}
      />

      <UploadStatus question={question} />

      <ul className="kajay-file__list">
        {question.files.map((entry) => (
          <AttachedFile
            key={entry.name}
            question={question}
            entry={entry}
            onRemove={() => {
              question.removeFile(entry.name);
            }}
          />
        ))}
      </ul>

      <QuestionErrors survey={survey} question={question} at="bottom" id={errorId} />
    </div>
  );
}
