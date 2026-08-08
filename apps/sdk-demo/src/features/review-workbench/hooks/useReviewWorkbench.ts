import { useCallback, useEffect, useMemo, useState } from 'react';
import { ReviewWorkbenchClient } from '../api/ReviewWorkbenchClient.js';
import { ReviewWorkbenchError } from '../api/ReviewWorkbenchError.js';
import type {
  ReviewDecisionInput,
  ReviewQueueItem,
  ReviewQueueStatus,
  ReviewTaskDetail,
} from '../api/ReviewWorkbenchTypes.js';

export function useReviewWorkbench(): ReviewWorkbenchState {
  const client = useMemo(() => new ReviewWorkbenchClient(), []);
  const queue = useReviewQueue(client);
  const task = useReviewTask(client, queue.refresh);
  return {
    ...queue,
    ...task,
    error: task.error ?? queue.error,
    isWorking: task.isWorking,
  };
}

function useReviewQueue(client: ReviewWorkbenchClient): ReviewQueueState {
  const [status, setStatus] = useState<ReviewQueueStatus>('pending');
  const [age, setAge] = useState<ReviewQueueAge>('any');
  const [managedName, setManagedName] = useState('');
  const [items, setItems] = useState<readonly ReviewQueueItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [needsLogin, setNeedsLogin] = useState(false);
  const load = useCallback(async (cursor?: string): Promise<void> => {
    setLoading(true);
    setError(undefined);
    try {
      const minimumCreatedAt = createdAfter(age);
      const page = await client.getTasks({
        status,
        ...(minimumCreatedAt === undefined ? {} : { createdAfter: minimumCreatedAt }),
        ...(managedName.trim().length === 0 ? {} : { managedDefinitionName: managedName }),
        ...(cursor === undefined ? {} : { cursor }),
      });
      setItems((current) => cursor === undefined ? page.items : [...current, ...page.items]);
      setNextCursor(page.nextCursor);
      setNeedsLogin(false);
    } catch (reason) {
      setNeedsLogin(reason instanceof ReviewWorkbenchError && reason.status === 401);
      setError(message(reason));
    } finally {
      setLoading(false);
    }
  }, [age, client, managedName, status]);
  useEffect(() => { void load(); }, [load]);
  return {
    status, setStatus, age, setAge, managedName, setManagedName, items, nextCursor, isLoading, error,
    needsLogin, refresh: () => load(),
    loadMore: () => nextCursor === undefined ? Promise.resolve() : load(nextCursor),
  };
}

function useReviewTask(
  client: ReviewWorkbenchClient,
  refresh: () => Promise<void>,
): ReviewTaskState {
  const [selected, setSelected] = useState<ReviewTaskDetail>();
  const [isWorking, setWorking] = useState(false);
  const [error, setError] = useState<string>();
  const open = useCallback(async (taskId: string): Promise<void> => {
    setWorking(true);
    setError(undefined);
    try {
      setSelected(await client.getTask(taskId));
    } catch (reason) {
      setError(message(reason));
    } finally {
      setWorking(false);
    }
  }, [client]);
  const decide = useCallback(async (input: ReviewDecisionInput): Promise<void> => {
    if (selected === undefined) return;
    setWorking(true);
    setError(undefined);
    try {
      await client.decide(selected, input);
      setSelected(undefined);
      await refresh();
    } catch (reason) {
      setError(reason instanceof ReviewWorkbenchError && reason.status === 412
        ? 'This workflow changed. Refresh the task before deciding.' : message(reason));
    } finally {
      setWorking(false);
    }
  }, [client, refresh, selected]);
  return { selected, isWorking, error, open, decide, close: () => { setSelected(undefined); } };
}

interface ReviewQueueState {
  readonly status: ReviewQueueStatus;
  readonly setStatus: (status: ReviewQueueStatus) => void;
  readonly age: ReviewQueueAge;
  readonly setAge: (age: ReviewQueueAge) => void;
  readonly managedName: string;
  readonly setManagedName: (name: string) => void;
  readonly items: readonly ReviewQueueItem[];
  readonly nextCursor: string | undefined;
  readonly isLoading: boolean;
  readonly error: string | undefined;
  readonly needsLogin: boolean;
  readonly refresh: () => Promise<void>;
  readonly loadMore: () => Promise<void>;
}

interface ReviewTaskState {
  readonly selected: ReviewTaskDetail | undefined;
  readonly isWorking: boolean;
  readonly error: string | undefined;
  readonly open: (taskId: string) => Promise<void>;
  readonly decide: (input: ReviewDecisionInput) => Promise<void>;
  readonly close: () => void;
}

export interface ReviewWorkbenchState extends ReviewQueueState, ReviewTaskState {}

export type ReviewQueueAge = 'any' | 'day' | 'week' | 'month';

function createdAfter(age: ReviewQueueAge): string | undefined {
  if (age === 'any') return undefined;
  const days = age === 'day' ? 1 : age === 'week' ? 7 : 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Review workbench request failed.';
}
