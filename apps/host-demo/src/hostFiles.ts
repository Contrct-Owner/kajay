import type { FileCleaner, FileEntry, FileUploadRequest, FileUploader } from '@kajay/core';

/**
 * A host's file storage, standing in for a bucket — checklist H1 and H3.
 *
 * Kept in memory because the demo has no backend and must stay deterministic. What the
 * rows are about is the *seam*: the library never sees a `File`, never fetches, and
 * never decides where anything is kept. Swapping this for a signed-URL upload is a
 * change to this file and to nothing else.
 */
const stored = new Map<string, FileEntry>();

/** What the demo panel shows, so a scenario can assert the host really was called. */
export function storedFileNames(): readonly string[] {
  return [...stored.keys()];
}

export const uploadFiles: FileUploader = async (request: FileUploadRequest) => {
  // A real host would be posting here, so the seam is asynchronous and the demo waits
  // like one — briefly, because every scenario that attaches a file pays for it.
  await new Promise((resolve) => {
    setTimeout(resolve, 20);
  });
  return request.files.map((file) => {
    const entry: FileEntry = {
      name: file.name,
      type: file.type,
      size: file.size,
      // The content stays *here* rather than in the response: that is the whole point of
      // having an uploader. A data URL is this demo's idea of "somewhere else".
      url: file.content ?? '',
    };
    stored.set(file.name, entry);
    return entry;
  });
};

export const clearFiles: FileCleaner = (request: FileUploadRequest) => {
  for (const file of request.files) {
    stored.delete(file.name);
  }
  return Promise.resolve();
};
