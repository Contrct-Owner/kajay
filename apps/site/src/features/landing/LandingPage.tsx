import { Link } from '@tanstack/react-router';
import type { ReactElement, ReactNode } from 'react';
import { ClientOnly } from '@/components/ClientOnly';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { DesignerDemo } from './components/DesignerDemo';
import { HeroSurvey } from './components/HeroSurvey';

/**
 * kajay.io — checklist P8.
 *
 * Every claim here is one the repository can back. The capability list is the parity
 * ledger read out loud, and the survey beside the headline is a real one, server-rendered,
 * drawn with this site's own primitive adapters. The packages are published, so the page
 * now gives visitors a working installation path as well as an interactive one.
 */
export function LandingPage(): ReactElement {
  return (
    <main className="mx-auto max-w-5xl px-6 pb-24">
      <TopBar />
      <Hero />
      <Thesis />
      <Capabilities />
      <Designer />
      <Availability />
    </main>
  );
}

function TopBar(): ReactElement {
  return (
    <header className="flex items-center justify-between py-6">
      <span className="text-lg font-semibold tracking-tight">Kajay</span>
      <nav aria-label="Primary" className="flex items-center gap-4">
        <Link className="text-muted-foreground hover:text-foreground text-sm" to="/docs">
          Docs
        </Link>
        <ThemeToggle />
      </nav>
    </header>
  );
}

function Hero(): ReactElement {
  return (
    <section className="grid gap-10 py-12 md:grid-cols-2 md:items-center">
      <div className="flex flex-col gap-6">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Surveys that look like your application.
        </h1>
        <p className="text-muted-foreground text-lg text-pretty">
          Bring your own components. Kajay lets your design system supply the common controls
          it already owns — buttons, inputs, textareas, checkboxes and radios — while
          specialized survey controls keep Kajay&rsquo;s accessible defaults.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link to="/playground">Open the playground</Link>
          </Button>
          <span className="text-muted-foreground text-sm">
            No signup. Nothing saved. Share a link.
          </span>
        </div>
      </div>
      <HeroSurvey />
    </section>
  );
}

function Thesis(): ReactElement {
  return (
    <section className="border-border border-t py-16">
      <h2 className="text-2xl font-semibold tracking-tight">One map, and the survey is yours</h2>
      <p className="text-muted-foreground mt-3 max-w-2xl text-pretty">
        Kajay routes five high-impact primitives through a small component map: Button,
        Input, Textarea, Checkbox and Radio. Supply as many or as few as you like; omitted
        primitives and specialized controls retain Kajay&rsquo;s working defaults.
      </p>
      <pre
        className="border-border bg-muted/40 mt-6 overflow-x-auto rounded-lg border p-4 text-sm"
        data-testid="survey-components-example"
      >
        <code>{`import { KAJAY_SURVEY_COMPONENTS } from '@/kajay/surveyComponents'

<Survey model={survey} components={KAJAY_SURVEY_COMPONENTS} />`}</code>
      </pre>
      <p className="text-muted-foreground mt-3 text-sm">
        The same composition seam dresses the designer, so the tool your customers build in
        looks like the product it lives in.
      </p>
    </section>
  );
}

/** What it does, in the acceptance ledger's own terms. */
function Capabilities(): ReactElement {
  return (
    <section className="border-border border-t py-16">
      <h2 className="text-2xl font-semibold tracking-tight">Everything you would expect</h2>
      <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        <Capability title="Every question type">
          Text in a dozen input types, choices, ratings, ranking, matrices, repeating panels,
          file upload, signatures and computed values.
        </Capability>
        <Capability title="Logic that holds">
          An expression language with a real parser and a dependency graph behind it —
          conditional visibility, computed values, triggers and validation all on one engine.
        </Capability>
        <Capability title="Validation">
          Built-in and custom validators, asynchronous checks against your own server, and
          errors placed where the mistake is.
        </Capability>
        <Capability title="Localization">
          Every user-facing string translatable, the library&rsquo;s own words replaceable, and
          right-to-left handled as layout rather than as a stylesheet.
        </Capability>
        <Capability title="Accessible by default">
          Keyboard-operable throughout, labelled and announced, and swept with axe in real
          Chromium on every commit.
        </Capability>
        <Capability title="A definition you own">
          Plain JSON that round-trips losslessly — parse, serialize, parse, unchanged — with a
          committed schema and a versioned contract another runtime can implement.
        </Capability>
      </div>
    </section>
  );
}

function Capability({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <div>
      <h3 className="font-medium">{title}</h3>
      <p className="text-muted-foreground mt-2 text-sm text-pretty">{children}</p>
    </div>
  );
}

function Designer(): ReactElement {
  return (
    <section className="border-border border-t py-16">
      <h2 className="text-2xl font-semibold tracking-tight">
        And a designer you can put in your product
      </h2>
      <p className="text-muted-foreground mt-3 max-w-2xl text-pretty">
        A drag-and-drop canvas, a property grid generated from the type registry, a visual
        logic editor, a JSON view, translations and theming — as one component, or as pieces
        you arrange yourself. Restrict which question types it offers, rename every word it
        says, and give it your components.
      </p>
      <div className="mt-8">
        <ClientOnly
          fallback={
            <div
              className="border-border text-muted-foreground rounded-lg border p-6 text-sm"
              data-testid="designer-demo-loading"
            >
              Loading the designer…
            </div>
          }
        >
          <DesignerDemo />
        </ClientOnly>
      </div>
      <div className="mt-6">
        <Button asChild variant="outline">
          <Link to="/playground">Build something in it</Link>
        </Button>
      </div>
    </section>
  );
}

function Availability(): ReactElement {
  return (
    <footer className="border-border text-muted-foreground border-t py-8 text-sm">
      <p data-testid="availability">
        Kajay 1.0 is available now. Install the runtime with{' '}
        <code className="text-foreground">npm install @kajay/core @kajay/react @kajay/themes</code>,
        or start with the <a href="/docs/quickstart/runtime">runtime quickstart</a>.
      </p>
    </footer>
  );
}
