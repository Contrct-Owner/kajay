import type { SurveyDefinition } from '@kajay/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DefinitionAuthoringClient,
} from '../api/DefinitionAuthoringClient.js';
import { DefinitionAuthoringError } from '../api/DefinitionAuthoringError.js';
import type {
  DefinitionDraft,
  DefinitionRelease,
  DefinitionRevision,
} from '../api/DefinitionAuthoringTypes.js';

export interface DefinitionAuthoringState {
  readonly definition: SurveyDefinition;
  readonly draft: DefinitionDraft | undefined;
  readonly revision: DefinitionRevision | undefined;
  readonly release: DefinitionRelease | undefined;
  readonly error: string | undefined;
  readonly isLoading: boolean;
  readonly isWorking: boolean;
  readonly needsLogin: boolean;
  readonly setDefinition: (definition: SurveyDefinition) => void;
  readonly save: (definition: SurveyDefinition) => Promise<boolean>;
  readonly checkpoint: () => Promise<void>;
  readonly createRelease: (versionLabel: string) => Promise<void>;
}

export function useDefinitionAuthoring(
  managedName: string,
  initialDefinition: SurveyDefinition,
): DefinitionAuthoringState {
  const client = useMemo(() => new DefinitionAuthoringClient(), []);
  const [definition, setDefinition] = useState(initialDefinition);
  const [draft, setDraft] = useState<DefinitionDraft>();
  const [revision, setRevision] = useState<DefinitionRevision>();
  const [release, setRelease] = useState<DefinitionRelease>();
  const [error, setError] = useState<string>();
  const [isLoading, setLoading] = useState(true);
  const [isWorking, setWorking] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => loadDraft(client, managedName, setDefinition, setDraft, setError,
    setNeedsLogin, setLoading), [client, managedName]);

  const save = useCallback((candidate: SurveyDefinition): Promise<boolean> => {
    return run(async () => {
      const saved = await client.saveDraft(managedName, draft?.version ?? 0, candidate);
      setDraft(saved);
      setDefinition(saved.definition);
      setRevision(undefined);
      setRelease(undefined);
    }, setWorking, setError, setNeedsLogin);
  }, [client, draft?.version, managedName]);

  const checkpoint = useCallback(async (): Promise<void> => {
    await run(async () => {
      if (draft === undefined) throw new Error('Save the draft before creating a revision.');
      setRevision(await client.checkpoint(managedName, draft.version));
      setRelease(undefined);
    }, setWorking, setError, setNeedsLogin);
  }, [client, draft, managedName]);

  const createRelease = useCallback(async (versionLabel: string): Promise<void> => {
    await run(async () => {
      if (revision === undefined) throw new Error('Create a revision before creating a release.');
      setRelease(await client.createRelease(managedName, revision.number, versionLabel));
    }, setWorking, setError, setNeedsLogin);
  }, [client, managedName, revision]);

  return { definition, draft, revision, release, error, isLoading, isWorking, needsLogin,
    setDefinition, save, checkpoint, createRelease };
}

function loadDraft(
  client: DefinitionAuthoringClient,
  managedName: string,
  setDefinition: (value: SurveyDefinition) => void,
  setDraft: (value: DefinitionDraft | undefined) => void,
  setError: (value: string | undefined) => void,
  setNeedsLogin: (value: boolean) => void,
  setLoading: (value: boolean) => void,
): () => void {
  let active = true;
  void client.getDraft(managedName).then((value) => {
    if (!active || value === undefined) return;
    setDraft(value);
    setDefinition(value.definition);
  }).catch((reason: unknown) => {
    if (!active) return;
    setNeedsLogin(reason instanceof DefinitionAuthoringError && reason.status === 401);
    setError(readError(reason));
  }).finally(() => { if (active) setLoading(false); });
  return () => { active = false; };
}

async function run(
  operation: () => Promise<void>,
  setWorking: (value: boolean) => void,
  setError: (value: string | undefined) => void,
  setNeedsLogin: (value: boolean) => void,
): Promise<boolean> {
  setWorking(true);
  setError(undefined);
  try {
    await operation();
    return true;
  } catch (reason) {
    setNeedsLogin(reason instanceof DefinitionAuthoringError && reason.status === 401);
    setError(readError(reason));
    return false;
  } finally {
    setWorking(false);
  }
}

function readError(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Definition authoring failed.';
}
