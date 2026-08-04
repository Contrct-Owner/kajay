import {
  DesignSurface,
  JsonEditorSession,
  PreviewSession,
  Toolbox,
  TranslationSession,
} from '@kajay/creator-core';
import { HistoryPanel, PageNavigatorPanel, useDesignerPlacement } from '@kajay/creator-react';
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import { DesignerJson } from './DesignerJson.js';
import { DesignerPreview } from './DesignerPreview.js';
import { DesignerTranslations } from './DesignerTranslations.js';
import { DesignerProperties } from './DesignerProperties.js';
import { DesignerSurface } from './DesignerSurface.js';
import { DesignerToolbox } from './DesignerToolbox.js';

/** A small survey to design, kept apart from the one the demo asks you to answer. */
const DESIGNED = {
  title: 'A survey being designed',
  pages: [
    {
      name: 'p1',
      title: 'Draft: the first page',
      colCount: 2,
      elements: [
        // Deliberately sharing no name, title or choice with the survey the demo asks
        // you to answer. They are two documents on one page, and a scenario reaching
        // for "paid" should never have to say which one it meant — the first version
        // of this reused those names and broke thirteen unrelated scenarios.
        { type: 'text', name: 'draftName', title: 'Draft: applicant name' },
        {
          type: 'radiogroup',
          name: 'draftTier',
          title: 'Draft: which tier?',
          choices: ['bronze', 'silver'],
        },
        {
          type: 'rating',
          name: 'draftScore',
          title: 'Draft: how likely to recommend?',
          startWithNewLine: true,
          // A reference to another question by name, so renaming `draftName` from the
          // property grid has something to be seen following it — L1's rename claim is
          // otherwise only provable in a unit test.
          visibleIf: '{draftName} notempty',
        },
        // A panel, so a drop *into* one is reachable at all — K2's last gap, and the
        // reason the row stayed partial until the canvas could adorn what is inside it.
        {
          type: 'panel',
          name: 'draftGroup',
          title: 'Draft: extra details',
          startWithNewLine: true,
          elements: [{ type: 'text', name: 'draftRole', title: 'Draft: your role' }],
        },
        { type: 'panel', name: 'draftEmpty', title: 'Draft: nothing here yet', elements: [] },
      ],
    },
    { name: 'p2', elements: [{ type: 'comment', name: 'draftNotes', title: 'Draft: notes' }] },
  ],
};

export interface DesignerProps {
  readonly theme: Readonly<Record<string, string>>;
}

/**
 * The Creator, assembled by the host out of pieces — checklists K1, K2, K3.
 *
 * This is what [ADR-0021](../../../docs/adr/0021-creator-composition.md) is for. The
 * toolbox and the design surface are two independent pieces with no knowledge of each
 * other, and *this file* is the thing that knows they belong together — a host could
 * put the toolbox in a sidebar their application already owns and the canvas in a route.
 *
 * It has to be one component rather than two, because a drag from the toolbox onto the
 * canvas is one gesture crossing both: the placement is created here and handed to each.
 * Two copies would be two gestures, one of which never finishes.
 */
/**
 * The sessions a host owns beside the surface — checklists M2, M3, M4.
 *
 * One hook because they share a lifetime and a reason: each follows the design surface's
 * changes, each is unmounted every time a designer switches tab, and each would take a
 * half-written definition or a half-filled run with it if it were built inside one.
 */
function useCreatorSessions(surface: DesignSurface): {
  readonly preview: PreviewSession;
  readonly json: JsonEditorSession;
  readonly translations: TranslationSession;
} {
  const sessions = useMemo(
    () => ({
      preview: new PreviewSession(surface),
      json: new JsonEditorSession(surface),
      // A pretend translation service, so the seam is exercised rather than described. A
      // real host calls whichever vendor they have an account with; nothing ships.
      translations: new TranslationSession(surface, {
        translate: (request) =>
          Promise.resolve(request.texts.map((text) => `[${request.to}] ${text}`)),
      }),
    }),
    [surface],
  );
  useEffect(
    () => () => {
      sessions.preview.dispose();
      sessions.json.dispose();
      sessions.translations.dispose();
    },
    [sessions],
  );
  return sessions;
}

export function Designer({ theme }: DesignerProps): ReactElement {
  // Built once: they hold the selection and the search term, and rebuilding them per
  // render would drop what the designer had picked or typed on every keystroke.
  const surface = useMemo(() => new DesignSurface({ definition: DESIGNED }), []);
  const toolbox = useMemo(() => new Toolbox(), []);
  const placement = useDesignerPlacement(surface);
  const sessions = useCreatorSessions(surface);
  const [tab, setTab] = useState<DesignerTab>('design');

  return (
    <>
      <DesignerTabs tab={tab} onChange={setTab} theme={theme} />
      {tab === 'design' ? (
        <>
          <DesignerToolbox
            theme={theme}
            toolbox={toolbox}
            getItemProps={placement.getItemProps}
          />
          <DesignerSurface theme={theme} surface={surface} placement={placement}>
            <HistoryPanel surface={surface} />
            <PageNavigatorPanel surface={surface} placement={placement} />
          </DesignerSurface>
          {/* Its own section rather than a strip inside the canvas — a property grid is
              the piece most likely to live somewhere the host already had a sidebar (L1)
              — and its own *file*, because everything this deployment has changed about
              the grid (L4) belongs with the host rather than beside the assembly. */}
          <DesignerProperties theme={theme} surface={surface} />
        </>
      ) : null}
      {tab === 'preview' ? <DesignerPreview theme={theme} session={sessions.preview} /> : null}
      {tab === 'json' ? <DesignerJson theme={theme} session={sessions.json} /> : null}
      {tab === 'translations' ? (
        <DesignerTranslations theme={theme} session={sessions.translations} />
      ) : null}
    </>
  );
}

type DesignerTab = 'design' | 'preview' | 'json' | 'translations';

const TAB_TITLES: Readonly<Record<DesignerTab, string>> = {
  design: 'Design',
  preview: 'Preview',
  json: 'JSON',
  translations: 'Translations',
};

/**
 * Design or preview, one at a time — checklist M3's word for it.
 *
 * **A tab, not a panel beside the others, and this deployment learned why the hard way.**
 * A preview is a *complete second survey* in the document: the same Next button, the same
 * navigation, the same roles. Rendered alongside the designer it made every page-wide
 * query in this app's own scenarios ambiguous — the same lesson K2 learned about a second
 * `role="status"`, arriving in a much larger size. The library is happy either way; a host
 * showing both at once needs to scope its queries, and the honest default is not to.
 */
function DesignerTabs({
  tab,
  onChange,
  theme,
}: {
  readonly tab: DesignerTab;
  readonly onChange: (tab: DesignerTab) => void;
  readonly theme: Readonly<Record<string, string>>;
}): ReactElement {
  return (
    <section className="host-demo__panel" aria-label="Designer tabs" style={theme as CSSProperties}>
      <div role="tablist" aria-label="Creator">
        {(['design', 'preview', 'json', 'translations'] as const).map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            data-testid={`tab-${name}`}
            onClick={() => {
              onChange(name);
            }}
          >
            {TAB_TITLES[name]}
          </button>
        ))}
      </div>
    </section>
  );
}
