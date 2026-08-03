import type { FileCleaner, FileDownloader, FileEntry, FileUploader } from './FileEntry.js';
import { asFileEntries, matchesAcceptedTypes } from './FileEntry.js';
import { Question } from './Question.js';
import type { SurveyError } from './SurveyError.js';
import type { ValidationContext } from './Validator.js';

/** The host-supplied halves of a file question: where files go, come from, and die. */
export interface FileSeams {
  readonly uploadFiles?: FileUploader;
  readonly downloadFile?: FileDownloader;
  readonly clearFiles?: FileCleaner;
}

/** Told when the attachments change — checklist A7. Not a seam: nothing is asked of it. */
export type FilesChangedListener = (
  files: readonly FileEntry[],
  change: 'attached' | 'removed',
) => void;

const TOO_LARGE = 'filetoolarge';
const WRONG_TYPE = 'filewrongtype';
const TOO_MANY = 'filetoomany';

/** Bytes, in the units a respondent reads. */
function describeSize(bytes: number): string {
  const megabytes = bytes / 1024 / 1024;
  return megabytes >= 1 ? `${megabytes.toFixed(1)} MB` : `${Math.ceil(bytes / 1024).toString()} KB`;
}

/**
 * A file the respondent attaches — checklist H1.
 *
 * The answer is always an array, even for a single file: a question that changed the
 * *shape* of its answer when `allowMultiple` was flipped would break every host reading
 * it, and a one-element array is a smaller surprise than a union.
 *
 * Where the content ends up is the host's decision, taken once by setting `uploadFiles`
 * or `storeDataAsText`. Core never sees a DOM `File` — the adapter converts, because
 * core is DOM-free and because what a survey needs to know about a file is only its
 * name, type, size and where to find it.
 */
export class FileQuestion extends Question {
  #seams: FileSeams = {};
  #onFilesChanged: FilesChangedListener | undefined;
  #isUploading = false;
  #failure: string | undefined;

  override get type(): string {
    return 'file';
  }

  get allowMultiple(): boolean {
    return this.getBooleanProperty('allowMultiple');
  }

  /** An `accept` list — `image/*`, `.pdf` — offered to the picker and enforced here. */
  get acceptedTypes(): string {
    return this.getStringProperty('acceptedTypes');
  }

  /** Bytes. 0 means no limit. */
  get maxSize(): number {
    return this.getNumberProperty('maxSize');
  }

  /** How many files may be attached at once. 0 means no limit. */
  get maxFileCount(): number {
    return this.getNumberProperty('maxFileCount');
  }

  get showPreview(): boolean {
    return this.getBooleanProperty('showPreview');
  }

  /**
   * Whether the content travels inside the response.
   *
   * Convenient and dangerous in equal measure: a response carrying three photographs is
   * a response that may not fit anywhere a host wants to put it. It is the honest
   * default only because the alternative — silently dropping the file when no uploader
   * is configured — would lose a respondent's work without saying so.
   */
  get storeDataAsText(): boolean {
    return this.getBooleanProperty('storeDataAsText');
  }

  /** Whether the picker should offer a camera rather than only the filesystem. */
  get allowCameraCapture(): boolean {
    return this.getBooleanProperty('allowCameraCapture');
  }

  /** The files currently attached. */
  get files(): readonly FileEntry[] {
    return asFileEntries(this.value);
  }

  /** True while an upload the host is doing has not come back. */
  get isUploading(): boolean {
    return this.#isUploading;
  }

  /** Why the last upload did not happen, or undefined. Cleared by the next attempt. */
  get uploadFailure(): string | undefined {
    return this.#failure;
  }

  /** Installed by `parseSurvey` from the survey options. Absent means keep the content. */
  attachFileSeams(seams: FileSeams): void {
    this.#seams = seams;
  }

  /**
   * Installs the listener the survey reports attachments on — checklist A7.
   *
   * A second argument rather than a fourth field on `FileSeams`, because the two have
   * different owners: the seams are what the *host* supplies and something is asked of
   * each, while this is what the *survey* watches and nothing is asked of it at all.
   */
  setFilesChangedListener(listener: FilesChangedListener): void {
    this.#onFilesChanged = listener;
  }

  /**
   * Asks the host where a stored file can be read from.
   *
   * A stored file may need a URL minted for it — a signed one that expires — so the
   * answer is a promise and the seam is optional: a file that carries its own `url` or
   * its own content needs nobody's help.
   */
  resolveUrl(entry: FileEntry): Promise<string> {
    const download = this.#seams.downloadFile;
    if (download === undefined) {
      return Promise.resolve(entry.url ?? entry.content ?? '');
    }
    return download(entry);
  }

  /**
   * Attaches files, storing them the way the definition asks.
   *
   * With an uploader the content goes to the host and the answer keeps what came back;
   * without one the content stays in the answer. Either way the answer only changes when
   * the storing succeeded — a failed upload leaves the previous files alone and says why,
   * rather than recording a reference to something that was never stored.
   */
  async addFiles(entries: readonly FileEntry[]): Promise<void> {
    this.#failure = undefined;
    const kept = this.allowMultiple ? [...this.files, ...entries] : entries.slice(0, 1);
    const uploader = this.#seams.uploadFiles;
    if (uploader === undefined) {
      this.value = this.#stored(kept);
      this.#onFilesChanged?.(entries, 'attached');
      return;
    }
    this.#isUploading = true;
    try {
      const uploaded = await uploader({ questionName: this.name, files: entries });
      const existing = this.allowMultiple ? this.files : [];
      this.value = [...existing, ...uploaded];
      // Inside the `try`, so a failed upload announces nothing: the answer did not
      // change, and a listener told otherwise would save a file the host never stored.
      this.#onFilesChanged?.(uploaded, 'attached');
    } catch (cause: unknown) {
      // Reported rather than thrown: an upload that failed is something the respondent
      // can retry, and an exception escaping a change handler is not.
      this.#failure = cause instanceof Error ? cause.message : String(cause);
    } finally {
      this.#isUploading = false;
    }
  }

  /**
   * What actually goes into the response when there is no uploader.
   *
   * `storeDataAsText` decides whether the content comes too. Without it the answer keeps
   * the file's *description* — enough to show what was attached and to validate it —
   * which is what a host that has not wired an uploader yet should see rather than a
   * silent nothing.
   */
  #stored(entries: readonly FileEntry[]): readonly FileEntry[] {
    if (this.storeDataAsText) {
      return entries;
    }
    return entries.map(({ content: _dropped, ...rest }) => rest);
  }

  /**
   * Removes one file, and tells the host so it can delete what it stored.
   *
   * The answer changes either way: a host that cannot delete its copy has a housekeeping
   * problem, and refusing to let the respondent detach the file would make it theirs.
   */
  removeFile(name: string): void {
    const going = this.files.filter((entry) => entry.name === name);
    const kept = this.files.filter((entry) => entry.name !== name);
    this.value = kept.length > 0 ? kept : undefined;
    this.#announceCleared(going);
  }

  clearFiles(): void {
    const going = this.files;
    this.value = undefined;
    this.#announceCleared(going);
  }

  #announceCleared(entries: readonly FileEntry[]): void {
    this.#onFilesChanged?.(entries, 'removed');
    const clear = this.#seams.clearFiles;
    if (clear === undefined || entries.length === 0) {
      return;
    }
    // Nothing waits for it and nothing fails because of it: deleting the host's copy is
    // housekeeping, and a rejected promise here must not become an unhandled one.
    void clear({ questionName: this.name, files: entries }).catch(() => {
      /* the host's own problem to log */
    });
  }

  /**
   * The rules the definition states about what may be attached.
   *
   * Checked in the model rather than left to the picker's `accept` and the browser's
   * size handling, because both are affordances: a respondent can drag a file past
   * `accept`, and nothing in HTML enforces a size at all.
   */
  override checkValue(context: ValidationContext): readonly SurveyError[] {
    const entries = asFileEntries(context.value);
    const errors: SurveyError[] = [];
    if (this.maxFileCount > 0 && entries.length > this.maxFileCount) {
      errors.push({
        kind: TOO_MANY,
        text: this.uiText('fileTooMany', this.maxFileCount),
      });
    }
    for (const entry of entries) {
      errors.push(...this.#checkEntry(entry));
    }
    return errors;
  }

  #checkEntry(entry: FileEntry): readonly SurveyError[] {
    const errors: SurveyError[] = [];
    const accept = this.acceptedTypes;
    if (accept.length > 0 && !matchesAcceptedTypes(entry, accept)) {
      errors.push({
        kind: WRONG_TYPE,
        text: this.uiText('fileWrongType', entry.name, accept),
        path: entry.name,
      });
    }
    if (this.maxSize > 0 && entry.size > this.maxSize) {
      errors.push({
        kind: TOO_LARGE,
        text: this.uiText('fileTooLarge', entry.name, describeSize(this.maxSize)),
        path: entry.name,
      });
    }
    return errors;
  }
}
