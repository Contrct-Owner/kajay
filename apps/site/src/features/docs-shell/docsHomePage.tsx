import type { DocPageDefinition } from './DocPageDefinition';

export const docsHomePage: DocPageDefinition = {
  slug: '',
  title: 'Kajay documentation',
  description: 'Build surveys that belong in your application, from definition to response.',
  section: 'Start',
  status: 'preview',
  audience: 'consumer',
  sdk: 'neutral',
  framework: 'neutral',
  toc: [
    { id: 'choose-a-path', label: 'Choose a path', depth: 2 },
    { id: 'version-1', label: 'Version 1.0', depth: 2 },
  ],
  content: (
    <>
      <section aria-labelledby="choose-a-path">
        <h2 id="choose-a-path">Choose a path</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <a className="border-border hover:bg-muted/40 block rounded-lg border p-5 no-underline" href="/docs/quickstart/runtime">
            <h3>Render surveys</h3>
            <p>
              Start with a JSON definition, parse it into a runtime model, and render it with
              your React components.
            </p>
          </a>
          <a className="border-border hover:bg-muted/40 block rounded-lg border p-5 no-underline" href="/docs/quickstart/creator">
            <h3>Embed the Creator</h3>
            <p>
              Give authors a complete survey designer or compose the Creator pieces into your
              own workspace.
            </p>
          </a>
        </div>
      </section>
      <section aria-labelledby="version-1">
        <h2 id="version-1">Version 1.0</h2>
        <p>
          Kajay 1.0 is published as five focused TypeScript packages. These pages describe
          behavior the repository proves on every change, and the playground lets you try the
          same public APIs without signing up or saving data.
        </p>
        <p>
          <a href="/playground">Open the playground</a>
        </p>
      </section>
    </>
  ),
};
