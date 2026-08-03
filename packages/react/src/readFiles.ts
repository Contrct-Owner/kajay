import type { FileEntry } from '@kajay/core';

/**
 * Turns a DOM `File` into what the model understands.
 *
 * This is the seam that keeps core DOM-free: the model's idea of a file is a name, a
 * type, a size and where the content is, and reading the content is something only a
 * browser can do. Everything above this line is plain data.
 *
 * The content is read as a data URL because that is the one form that works everywhere
 * it might end up — inside a JSON response, in an `img` preview, or posted to a host's
 * uploader — without the model needing to know which.
 */
export function readFile(file: File): Promise<FileEntry> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      resolve({
        name: file.name,
        type: file.type,
        size: file.size,
        content: typeof reader.result === 'string' ? reader.result : '',
      });
    });
    reader.addEventListener('error', () => {
      // A file the browser cannot read still happened: the respondent picked it, and
      // the model's rules — type, size — can object to it on the description alone.
      // Resolving with no content beats rejecting into a change handler.
      resolve({ name: file.name, type: file.type, size: file.size });
    });
    reader.readAsDataURL(file);
  });
}

/** Reads a picked or dropped list, in the order the respondent chose them. */
export function readFiles(files: readonly File[]): Promise<readonly FileEntry[]> {
  return Promise.all(files.map((file) => readFile(file)));
}
