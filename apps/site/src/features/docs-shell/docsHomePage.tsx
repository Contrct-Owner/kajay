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
    { id: 'preview-documentation', label: 'Preview documentation', depth: 2 },
  ],
  content: (
    <>
      <section aria-labelledby="choose-a-path">
        <h2 id="choose-a-path">Choose a path</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="border-border rounded-lg border p-5">
            <h3>Render surveys</h3>
            <p>
              Start with a JSON definition, parse it into a runtime model, and render it with
              your React components.
            </p>
          </div>
          <div className="border-border rounded-lg border p-5">
            <h3>Embed the Creator</h3>
            <p>
              Give authors a complete survey designer or compose the Creator pieces into your
              own workspace.
            </p>
          </div>
        </div>
      </section>
      <section aria-labelledby="preview-documentation">
        <h2 id="preview-documentation">Preview documentation</h2>
        <p>
          Kajay is not published yet, so there is nothing to install today. These pages
          describe behavior the repository already proves and will grow alongside the public
          release. You can use the playground now without signing up or saving data.
        </p>
        <p>
          <a href="/playground">Open the playground</a>
        </p>
      </section>
    </>
  ),
};

