import type { ReactNode } from 'react';

export interface RuntimeDocHeading {
  readonly id: string;
  readonly label: string;
  readonly depth: 2 | 3;
}

export interface RuntimeDocPage {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly section: 'Start' | 'Surveys';
  readonly status: 'preview';
  readonly audience: 'consumer';
  readonly sdk: 'neutral' | 'typescript';
  readonly framework: 'neutral' | 'react';
  readonly toc: readonly RuntimeDocHeading[];
  readonly content: ReactNode;
}
