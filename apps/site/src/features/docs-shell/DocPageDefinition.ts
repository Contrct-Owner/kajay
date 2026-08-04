import type { ReactNode } from 'react';

export type DocPageStatus = 'preview' | 'stable';

export type DocPageAudience = 'consumer' | 'extension' | 'advanced';

export type DocPageSdk = 'neutral' | 'typescript';

export type DocPageFramework = 'neutral' | 'react';

export interface DocTableOfContentsItem {
  readonly id: string;
  readonly label: string;
  readonly depth: 2 | 3;
}

/** The contract authored and generated documentation pages plug into. */
export interface DocPageDefinition {
  /** Path below `/docs`, without a leading slash. The empty string is the docs home. */
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly section: string;
  readonly status: DocPageStatus;
  readonly audience: DocPageAudience;
  readonly sdk: DocPageSdk;
  readonly framework: DocPageFramework;
  readonly toc?: readonly DocTableOfContentsItem[];
  readonly content: ReactNode;
}

