/** The host-owned I/O adapter used by URL-backed choice sources. */
export type ChoiceFetcher = (url: string) => Promise<unknown>;
