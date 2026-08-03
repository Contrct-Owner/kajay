/**
 * One file, as the model knows it — checklist H1.
 *
 * Plain data, never a DOM `File`. Core is DOM-free by rule, so the adapter that has a
 * real file turns it into this before the model sees it: what a survey needs to know
 * about a file is its name, what kind of thing it is, how big it is, and where its
 * content can be found.
 *
 * `content` and `url` are the two answers to that last question, and which one is
 * present is the whole `storeDataAsText`-versus-upload distinction: either the content
 * travels inside the response, or the host stored it somewhere and the response carries
 * a reference.
 */
export interface FileEntry {
  readonly name: string;
  /** The MIME type the picker reported. Empty when the platform would not say. */
  readonly type: string;
  /** Size in bytes, as reported. */
  readonly size: number;
  /** The file itself, as a data URL, when the response carries it. */
  readonly content?: string;
  /** Where the host put it, when the host stored it. */
  readonly url?: string;
}

/** What the model hands a host's uploader: the files, and which question they answer. */
export interface FileUploadRequest {
  readonly questionName: string;
  readonly files: readonly FileEntry[];
}

/**
 * Stores files somewhere the response can point at, and says where.
 *
 * Returns entries rather than URLs so a host may correct the name, drop one, or add a
 * type it worked out for itself — and so the seam has somewhere to grow.
 */
export type FileUploader = (request: FileUploadRequest) => Promise<readonly FileEntry[]>;

/** Mints a URL for a stored file, when one has to be asked for rather than kept. */
export type FileDownloader = (entry: FileEntry) => Promise<string>;

/** Told when files leave an answer, so a host can delete what it stored. */
export type FileCleaner = (request: FileUploadRequest) => Promise<void>;

/** The entries an answer holds, whatever shape the answer arrived in. */
export function asFileEntries(value: unknown): readonly FileEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is FileEntry => isFileEntry(entry));
}

function isFileEntry(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const entry = value as Partial<FileEntry>;
  return typeof entry.name === 'string';
}

/**
 * Whether a file matches an `accept` list.
 *
 * The same grammar a file picker understands — `image/*`, `.pdf`, `text/csv` — because
 * the author writes it once and it is handed to the picker *and* checked here. The
 * picker's version is an affordance a respondent can defeat by dragging, so this is
 * where it actually holds, exactly as C1's `min` is checked in the model rather than
 * trusted to the input.
 */
export function matchesAcceptedTypes(entry: FileEntry, accept: string): boolean {
  const patterns = accept
    .split(',')
    .map((pattern) => pattern.trim().toLowerCase())
    .filter((pattern) => pattern.length > 0);
  if (patterns.length === 0) {
    return true;
  }
  const type = entry.type.toLowerCase();
  const name = entry.name.toLowerCase();
  return patterns.some((pattern) => {
    if (pattern.startsWith('.')) {
      return name.endsWith(pattern);
    }
    if (pattern.endsWith('/*')) {
      return type.startsWith(pattern.slice(0, -1));
    }
    return type === pattern;
  });
}
