/** Payloads of the typed event surface hosts and renderers program against. */

export interface ValueChangedEvent {
  readonly name: string;
  readonly value: unknown;
  readonly previousValue: unknown;
}

export interface CompleteEvent {
  readonly data: Readonly<Record<string, unknown>>;
}

export interface CurrentPageChangedEvent {
  readonly previousPageNo: number;
  readonly currentPageNo: number;
}
