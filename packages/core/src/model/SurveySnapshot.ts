import type { Survey } from './Survey.js';
import { silenceEvents } from '../events/EventEmitter.js';
import { readProgress } from './SurveyProgress.js';
import { decodeSnapshotValue, encodeSnapshotValue } from './SurveySnapshotValue.js';
import type { SurveySnapshotValue } from './SurveySnapshotValue.js';
import { readTimerPersistence, writeTimerPersistence } from './SurveyTimer.js';
import type { TimerPersistenceState } from './SurveyTimer.js';
import { rehydrateSurveyStatus } from './SurveyStatus.js';

export type DurableSurveyState = 'empty' | 'running' | 'preview' | 'completed';

export interface SurveyTimerAnchors {
  readonly surveyStartedAt: string;
  readonly pageStartedAt: string;
}

export interface SurveySnapshot {
  readonly formatVersion: 1;
  readonly definitionDigest: string;
  readonly conformanceVersion: 2;
  readonly data: Readonly<Record<string, SurveySnapshotValue>>;
  readonly pageName: string;
  readonly locale: string;
  readonly lifecycle: DurableSurveyState;
  readonly timer: SurveyTimerAnchors | null;
}

export class UnsupportedSurveySnapshotVersionError extends Error {
  readonly declaredVersion: number;

  constructor(declaredVersion: number) {
    super(`Response Snapshot format version ${declaredVersion} is not supported.`);
    this.name = 'UnsupportedSurveySnapshotVersionError';
    this.declaredVersion = declaredVersion;
  }
}

const definitionDigests = new WeakMap<Survey, string>();

export function bindDefinitionDigest(survey: Survey, digest: string): void {
  definitionDigests.set(survey, digest);
}

export function captureSnapshot(survey: Survey): SurveySnapshot {
  const definitionDigest = definitionDigests.get(survey);
  if (definitionDigest === undefined) {
    throw new Error('A Response Snapshot requires a Survey created through parseSurvey.');
  }
  if (survey.status.state === 'loading') {
    throw new Error('A Response Snapshot cannot capture the host-owned loading state.');
  }
  const progress = readProgress(survey);
  const timerState = readTimerPersistence(survey.timer);
  return {
    formatVersion: 1,
    definitionDigest,
    conformanceVersion: 2,
    data: Object.fromEntries(
      Object.entries(progress.data).map(([name, value]) => [name, encodeSnapshotValue(value)]),
    ),
    pageName: progress.pageName,
    locale: survey.locale,
    lifecycle: survey.status.state,
    timer: timerState === undefined ? null : {
      surveyStartedAt: new Date(timerState.surveyStartedAt).toISOString(),
      pageStartedAt: new Date(timerState.pageStartedAt).toISOString(),
    },
  };
}

export function applySnapshot(survey: Survey, snapshot: SurveySnapshot): void {
  assertSnapshot(snapshot);
  const definitionDigest = definitionDigests.get(survey);
  if (definitionDigest !== snapshot.definitionDigest) {
    throw new Error('The Response Snapshot definition digest does not match this Survey.');
  }
  const data = Object.fromEntries(
    Object.entries(snapshot.data).map(([name, value]) => [name, decodeSnapshotValue(value)]),
  );
  const timer = decodeTimer(snapshot.timer);
  silenceSurveyEvents(survey, () => {
    for (const name of Object.keys(readProgress(survey).data)) {
      survey.setValue(name, undefined);
    }
    survey.setData(data);
    if (survey.pageCount > 0) survey.setCurrentPageNo(0);
    if (snapshot.pageName.length > 0) survey.goTo(snapshot.pageName);
    survey.setLocale(snapshot.locale);
    rehydrateSurveyStatus(survey.status, snapshot.lifecycle);
    writeTimerPersistence(survey.timer, timer);
  });
}

/** Parses and validates JSON stored as Response Snapshot Format v1. */
export function parseSurveySnapshot(json: string): SurveySnapshot {
  const parsed: unknown = JSON.parse(json);
  assertSnapshot(parsed);
  return parsed;
}

function assertSnapshot(snapshot: unknown): asserts snapshot is SurveySnapshot {
  if (typeof snapshot !== 'object' || snapshot === null || Array.isArray(snapshot)) {
    throw new TypeError('A Response Snapshot must be a JSON object.');
  }
  const version = (snapshot as { readonly formatVersion?: unknown }).formatVersion;
  if (version !== 1) {
    throw new UnsupportedSurveySnapshotVersionError(
      typeof version === 'number' ? version : Number.NaN,
    );
  }
  const candidate = snapshot as Partial<SurveySnapshot>;
  if (candidate.conformanceVersion !== 2) {
    throw new TypeError(`Response Snapshot conformance version ${String(candidate.conformanceVersion)} is not supported.`);
  }
  if (typeof candidate.definitionDigest !== 'string'
    || !/^sha256:[0-9a-f]{64}$/u.test(candidate.definitionDigest)) {
    throw new TypeError('A Response Snapshot definition digest is invalid.');
  }
  if (typeof candidate.pageName !== 'string' || typeof candidate.locale !== 'string') {
    throw new TypeError('A Response Snapshot pageName and locale must be strings.');
  }
  if (!isDurableState(candidate.lifecycle)) {
    throw new TypeError(`Unknown durable survey lifecycle "${String(candidate.lifecycle)}".`);
  }
  if (typeof candidate.data !== 'object' || candidate.data === null || Array.isArray(candidate.data)) {
    throw new TypeError('A Response Snapshot data property must be an object.');
  }
  for (const value of Object.values(candidate.data)) {
    decodeSnapshotValue(value);
  }
  decodeTimer(candidate.timer ?? null);
  if (candidate.lifecycle === 'completed' && candidate.timer !== null) {
    throw new TypeError('A completed Response Snapshot cannot have a running timer.');
  }
}

function isDurableState(value: unknown): value is DurableSurveyState {
  return value === 'empty' || value === 'running' || value === 'preview' || value === 'completed';
}

function decodeTimer(anchors: SurveyTimerAnchors | null): TimerPersistenceState | undefined {
  if (anchors === null) return undefined;
  const surveyStartedAt = parseInstant(anchors.surveyStartedAt);
  const pageStartedAt = parseInstant(anchors.pageStartedAt);
  if (pageStartedAt < surveyStartedAt) {
    throw new TypeError('A Response Snapshot page timer cannot start before its survey timer.');
  }
  return { surveyStartedAt, pageStartedAt };
}

function parseInstant(value: string): number {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw new TypeError(`Invalid Response Snapshot timer instant "${value}".`);
  }
  return milliseconds;
}

function silenceSurveyEvents(survey: Survey, action: () => void): void {
  const emitters = [
    survey.onValueChanged,
    survey.onCurrentPageChanged,
    survey.onLocaleChanged,
    survey.onStateChanged,
    survey.onComplete,
    survey.onElementStateChanged,
    survey.onRecordsChanged,
    survey.onFilesChanged,
    survey.onValidateQuestion,
    survey.onValidatingChanged,
  ] as const;
  const silenceAt = (index: number): void => {
    const emitter = emitters[index];
    if (emitter === undefined) action();
    else silenceEvents(emitter, () => silenceAt(index + 1));
  };
  silenceAt(0);
}
