import type { SurveyDefinition, SurveySnapshot } from '@kajay/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  WorkflowDemoClient,
  type DemoWorkflowInstance,
} from '../api/WorkflowDemoClient.js';

const instanceStorageKey = 'kajay-review-demo-instance';

export function useWorkflowDemo(): WorkflowDemoState {
  const client = useMemo(() => new WorkflowDemoClient(), []);
  const [definition, setDefinition] = useState<SurveyDefinition>();
  const [instance, setInstance] = useState<DemoWorkflowInstance>();
  const [isWorking, setWorking] = useState(true);
  const [error, setError] = useState<string>();
  const run = useCallback(async (action: () => Promise<DemoWorkflowInstance>): Promise<void> => {
    setWorking(true);
    setError(undefined);
    try {
      const next = await action();
      setInstance(next);
      localStorage.setItem(instanceStorageKey, next.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Workflow demo request failed.');
    } finally {
      setWorking(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    void client.getDefinition().then((value) => { if (active) setDefinition(value); })
      .catch((reason: unknown) => { if (active) setError(String(reason)); });
    const stored = localStorage.getItem(instanceStorageKey);
    if (stored === null) setWorking(false);
    else void run(() => client.get(stored));
    return () => { active = false; };
  }, [client, run]);
  return {
    definition,
    instance,
    isWorking,
    error,
    start: () => run(() => client.start()),
    refresh: () => instance === undefined ? Promise.resolve() : run(() => client.get(instance.id)),
    submit: (snapshot) => instance === undefined
      ? Promise.resolve()
      : run(() => client.submit(instance, snapshot)),
    reset: () => {
      localStorage.removeItem(instanceStorageKey);
      setInstance(undefined);
      setError(undefined);
    },
  };
}

export interface WorkflowDemoState {
  readonly definition: SurveyDefinition | undefined;
  readonly instance: DemoWorkflowInstance | undefined;
  readonly isWorking: boolean;
  readonly error: string | undefined;
  readonly start: () => Promise<void>;
  readonly refresh: () => Promise<void>;
  readonly submit: (snapshot: SurveySnapshot) => Promise<void>;
  readonly reset: () => void;
}
