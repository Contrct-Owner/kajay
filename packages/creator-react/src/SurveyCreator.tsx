import { SaveController } from '@kajay/creator-core';
import type {
  CreatorConfiguration,
  CreatorStringDictionary,
  MachineTranslator,
  SurveySaver,
  ThemeDocument,
} from '@kajay/creator-core';
import type { MetadataRegistry, ParseOptions, SurveyDefinition } from '@kajay/core';
import type { PageElementRendererResolver } from '@kajay/react';
import { useRef, useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import { CreatorComponentsProvider } from './CreatorComponents.js';
import type { CreatorComponents } from './CreatorComponents.js';
import { CreatorStringsProvider } from './CreatorStringsContext.js';
import { CreatorTabs, DEFAULT_CREATOR_TABS } from './CreatorTabs.js';
import type { CreatorTab } from './CreatorTabs.js';
import { useCreatorDocument } from './useCreatorDocument.js';
import { useCreatorWorkspace } from './useCreatorWorkspace.js';

export interface SurveyCreatorProps {
  /**
   * The definition the Creator opens, and what a host pushes a new document in through.
   *
   * See {@link useCreatorDocument} for exactly what "controlled" means here — the short
   * version is that the Creator's own output coming back is not a change.
   */
  readonly value?: SurveyDefinition | undefined;
  readonly onChange?: ((definition: SurveyDefinition) => void) | undefined;
  /** Where a save goes — checklist N1. Absent means the Creator offers no save button. */
  readonly save?: SurveySaver | undefined;
  /** Whether every change is saved, or only a press of the button. */
  readonly isAutoSave?: boolean | undefined;
  /** Which tabs to show, in order. Defaults to all of them — checklist N2. */
  readonly tabs?: readonly CreatorTab[] | undefined;
  /**
   * What this deployment has turned off — checklist N2.
   *
   * A plain value so it can be written in JSON, stored against a customer and sent from a
   * server: a deployment offering three question types to one tenant and thirty to another
   * has to be able to *say* so somewhere other than in code.
   */
  readonly configuration?: CreatorConfiguration | undefined;
  readonly registry?: MetadataRegistry | undefined;
  /** Renderers for the canvas and the preview. Pass a clone to draw a custom type. */
  readonly renderers?: PageElementRendererResolver | undefined;
  /** The host's own seams, handed to the previewed survey exactly as §M3 describes. */
  readonly parse?: ParseOptions | undefined;
  readonly translate?: MachineTranslator | undefined;
  readonly theme?: ThemeDocument | undefined;
  /**
   * The Creator's own words — checklist N3.
   *
   * Absent means English. A host registers over the built-ins rather than replacing them,
   * so renaming one button does not blank the other eighty.
   */
  readonly strings?: CreatorStringDictionary | undefined;
  /**
   * Which language the Creator's own chrome is in — checklist N3.
   *
   * **Separate from the survey's own locale**, deliberately: a designer working in German
   * on a survey written in French wants German chrome and French content, and tying the
   * two together would make that impossible to say.
   */
  readonly locale?: string | undefined;
  /**
   * CSS custom properties for the Creator's **own** chrome — checklist N3.
   *
   * Distinct from `theme`, which is the survey being designed. A white-labelled Creator
   * that had to look like the survey it edits would be no use to anybody: an agency's tool
   * is their brand and their client's survey is the client's.
   */
  readonly creatorTheme?: Readonly<Record<string, string>> | undefined;
  /** The host's design-system primitives, shared by every piece in this assembly. */
  readonly components?: CreatorComponents | undefined;
  readonly className?: string;
}

/**
 * The default assembly — checklist N1, and what
 * [ADR-0021](../../../docs/adr/0021-creator-composition.md) promised.
 *
 * **Built from nothing but the pieces this package already exports**, which is decision 3
 * of that ADR and the only thing keeping the pieces real: if the assembly ever needed
 * something the pieces do not expose, that is a missing export rather than a special case.
 * Every panel below is reachable by a host who wants to arrange them differently, and this
 * file is what they would have written.
 *
 * It holds the workspace, because somebody has to and a host arranging their own layout
 * would hold the same one. Everything else it holds is the tab somebody is looking at.
 */
export function SurveyCreator({
  value,
  onChange,
  save,
  isAutoSave = false,
  tabs = DEFAULT_CREATOR_TABS,
  configuration,
  registry,
  renderers,
  parse,
  translate,
  theme,
  strings,
  locale,
  creatorTheme,
  components,
  className,
}: SurveyCreatorProps): ReactElement {
  const workspace = useCreatorWorkspace({
    definition: value ?? {},
    registry,
    configuration,
    preview: { parse },
    translations: { translate },
    themeEditor: { theme },
  });
  const saver = useSaveController(save);
  useCreatorDocument({
    surface: workspace.surface,
    value,
    onChange,
    autoSave: isAutoSave ? saver : undefined,
  });
  const [tab, setTab] = useState<CreatorTab>(tabs[0] ?? 'design');
  const body = (
    <div className={joinClasses('kajay-creator', className)} style={creatorTheme as CSSProperties}>
      <CreatorTabs
        workspace={workspace}
        configuration={configuration}
        tabs={tabs}
        tab={tabs.includes(tab) ? tab : (tabs[0] ?? 'design')}
        onTabChange={setTab}
        saver={saver}
        renderers={renderers}
      />
    </div>
  );

  return <CreatorProviders components={components} strings={strings} locale={locale} body={body} />;
}

/** The application-wide seams surrounding the assembled pieces. */
function CreatorProviders({
  components,
  strings,
  locale,
  body,
}: Pick<SurveyCreatorProps, 'components' | 'strings' | 'locale'> & {
  readonly body: ReactElement;
}): ReactElement {
  // With no prop, inherit a surrounding provider exactly as any standalone piece does.
  // An unconditional empty provider here would make wrapping the assembly behave
  // differently from wrapping its exported pieces.
  const primitiveBody =
    components === undefined ? (
      body
    ) : (
      <CreatorComponentsProvider components={components}>{body}</CreatorComponentsProvider>
    );
  // The strings provider only when a host supplied words. A piece rendered with none gets
  // English and works, which is what keeps the pieces usable alone (ADR-0021).
  return strings === undefined ? (
    primitiveBody
  ) : (
    <CreatorStringsProvider dictionary={strings} locale={locale}>
      {primitiveBody}
    </CreatorStringsProvider>
  );
}

/**
 * The save controller, built once around whatever `save` is *now*.
 *
 * A controller rebuilt when the prop's identity changed would lose the state of a save in
 * flight — and `save={() => fetch(…)}` inline changes identity on every render. So the
 * controller is stable and calls through a ref, which is the same identity trap as the
 * workspace above and the same answer.
 */
function useSaveController(save: SurveySaver | undefined): SaveController | undefined {
  const latest = useRef(save);
  latest.current = save;
  const [controller] = useState(
    () => new SaveController((definition) => latest.current?.(definition) ?? false),
  );
  return save === undefined ? undefined : controller;
}

function joinClasses(base: string, extra: string | undefined): string {
  return extra === undefined || extra.length === 0 ? base : `${base} ${extra}`;
}
