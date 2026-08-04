import { CreatorWorkspace } from '@kajay/creator-core';
import type { CreatorWorkspaceOptions } from '@kajay/creator-core';
import { useEffect, useRef, useState } from 'react';

interface DisposalRequest {
  isCancelled: boolean;
}

/**
 * Owns one headless Creator workspace for a React mount.
 *
 * Initialization options are read once. A host changing the registry, configuration, or
 * session seams remounts with a different key; a changed document goes through
 * `useCreatorDocument` and preserves the workspace's selection and history.
 *
 * React StrictMode probes an effect by running setup, cleanup, then setup again. Terminally
 * disposing in that synthetic cleanup would leave the committed workspace disconnected.
 * Cleanup is therefore queued for the end of the current task and the replay setup cancels
 * it. A real unmount has no matching setup, so it disposes exactly once in that microtask.
 */
export function useCreatorWorkspace(options: CreatorWorkspaceOptions): CreatorWorkspace {
  const [workspace] = useState<CreatorWorkspace>(() => new CreatorWorkspace(options));
  const pendingDisposal = useRef<DisposalRequest | null>(null);

  useEffect(() => {
    const pending = pendingDisposal.current;
    if (pending !== null) {
      pending.isCancelled = true;
      pendingDisposal.current = null;
    }
    return () => {
      const request: DisposalRequest = { isCancelled: false };
      pendingDisposal.current = request;
      queueMicrotask(() => {
        if (!request.isCancelled) {
          workspace.dispose();
        }
      });
    };
  }, [workspace]);

  return workspace;
}
