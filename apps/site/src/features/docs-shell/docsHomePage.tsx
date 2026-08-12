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
    { id: 'version-1', label: 'Version 1.x', depth: 2 },
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
          <a className="border-border hover:bg-muted/40 block rounded-lg border p-5 no-underline" href="/docs/quickstart/dotnet">
            <h3>Run surveys in .NET</h3>
            <p>
              Parse the same Kajay definition and execute its headless runtime natively
              with <code>Kajay.Core</code>.
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
        <h2 id="version-1">Version 1.x</h2>
        <p>
          Kajay ships five focused TypeScript packages and the native <code>Kajay.Core</code>{' '}
          NuGet package. Shared definition and compatibility pages apply to both runtimes;
          SDK-specific guides state where their APIs and product surfaces differ.
        </p>
        <p>
          <a href="/playground">Open the playground</a>
        </p>
      </section>
    </>
  ),
};
