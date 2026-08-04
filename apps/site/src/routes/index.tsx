import { Link, createFileRoute } from '@tanstack/react-router';
import type { ReactElement, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { HeroSurvey } from '@/landing/HeroSurvey';
import { ClientOnly } from '@/components/ClientOnly';
import { DesignerDemo } from '@/landing/DesignerDemo';

export const Route = createFileRoute('/')({ component: Landing });

/**
 * kajay.io — checklist P8.
 *
 * **Every claim here is one the repository can back.** The capability list is the parity
 * ledger read out loud, and the survey beside the headline is a real one, server-rendered,
 * drawn with this site's own components. Nothing says "install", because nothing is
 * installable yet: a page whose first instruction fails is worse than a page with one
 * fewer button.
 *
 * No competitor is named. The capability is the argument, and a comparison is one that has
 * to be re-won on every release of somebody else's software.
 */
function Landing(): ReactElement {
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
      <ThemeToggle />
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
          Bring your own components. Kajay draws every control through your design system —
          the same Button, Input and Select your product already ships — so a survey stops
          looking like something you embedded.
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
      {/*
        **The demonstration is the hero image.** Everything in it — the radio group, the
        checkboxes, the comment that appears once there is something to say — is drawn with
        the components in `src/components/ui/`, which is where this page's own buttons come
        from too. A screenshot would have been easier and would have proved nothing.
      */}
      <HeroSurvey />
    </section>
  );
}

function Thesis(): ReactElement {
  return (
    <section className="border-border border-t py-16">
      <h2 className="text-2xl font-semibold tracking-tight">One map, and the survey is yours</h2>
      <p className="text-muted-foreground mt-3 max-w-2xl text-pretty">
        Most survey libraries offer CSS variables and hope. Kajay takes a small, closed set of
        components — the ones every design system already has — and draws everything out of
        them. Supply as many or as few as you like; the rest fall back to ours.
      </p>
      <pre className="border-border bg-muted/40 mt-6 overflow-x-auto rounded-lg border p-4 text-sm">
        <code>{`import { Button, Input, Select } from '@/components/ui'

<Survey model={survey} components={{ Button, Input, Select }} />`}</code>
      </pre>
      <p className="text-muted-foreground mt-3 text-sm">
        The same idea dresses the designer, so the tool your customers build in looks like the
        product it lives in.
      </p>
    </section>
  );
}

/**
 * What it does, in the acceptance ledger's own terms.
 *
 * Each line names a section of the parity checklist that is **green**, so none of it is a
 * roadmap item wearing a present tense. That constraint is why there is no "coming soon"
 * column: if it cannot be pointed at a passing proof, it does not go on the page.
 */
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
      {/*
        **Client-only, and the hero above is not.** A survey is content — it should be in
        the document the server sends, and P1 made sure it can be. A design surface has to
        measure things before it can draw them, so there is nothing a server render would
        be right about. The two halves of this page answer that question differently
        because they are genuinely different questions.
      */}
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
      {/*
        Said plainly rather than left for somebody to find out by typing `npm install`. The
        packages are private and unlicensed and the scope is unclaimed; a page implying
        otherwise would waste the time of exactly the people it is meant to reach.
      */}
      <p data-testid="availability">
        Kajay is not published yet — there is nothing to install today. The playground runs the
        real thing.
      </p>
    </footer>
  );
}
