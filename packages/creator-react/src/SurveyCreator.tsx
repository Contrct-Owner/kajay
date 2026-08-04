import {
  DesignSurface,
  JsonEditorSession,
  LogicSession,
  PreviewSession,
  SaveController,
  ThemeEditorSession,
  Toolbox,
  TranslationSession,
} from '@kajay/creator-core';
import type { MachineTranslator, SurveySaver, ThemeDocument } from '@kajay/creator-core';
import type { MetadataRegistry, ParseOptions, SurveyDefinition } from '@kajay/core';
import type { PageElementRendererRegistry } from '@kajay/react';
import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { CreatorTabs, DEFAULT_CREATOR_TABS } from './CreatorTabs.js';
import type { CreatorTab } from './CreatorTabs.js';
import { useCreatorDocument } from './useCreatorDocument.js';

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
  /** Which tabs to show, in order. Defaults to all of them. */
  readonly tabs?: readonly CreatorTab[] | undefined;
  readonly registry?: MetadataRegistry | undefined;
  /** Renderers for the canvas and the preview. Pass a clone to draw a custom type. */
  readonly renderers?: PageElementRendererRegistry | undefined;
  /** The host's own seams, handed to the previewed survey exactly as §M3 describes. */
  readonly parse?: ParseOptions | undefined;
  readonly translate?: MachineTranslator | undefined;
  readonly theme?: ThemeDocument | undefined;
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
 * It holds the models, because somebody has to and a host arranging their own layout would
 * hold the same ones. Everything else it holds is the tab somebody is looking at.
 */
export function SurveyCreator({
  value,
  onChange,
  save,
  isAutoSave = false,
  tabs = DEFAULT_CREATOR_TABS,
  registry,
  renderers,
  parse,
  translate,
  theme,
  className,
}: SurveyCreatorProps): ReactElement {
  const models = useCreatorModels({ value, registry, parse, translate, theme });
  const saver = useSaveController(save);
  useCreatorDocument({
    surface: models.surface,
    value,
    onChange,
    autoSave: isAutoSave ? saver : undefined,
  });
  const [tab, setTab] = useState<CreatorTab>(tabs[0] ?? 'design');

  return (
    <div className={joinClasses('kajay-creator', className)}>
      <CreatorTabs
        models={models}
        tabs={tabs}
        tab={tabs.includes(tab) ? tab : (tabs[0] ?? 'design')}
        onTabChange={setTab}
        saver={saver}
        renderers={renderers}
      />
    </div>
  );
}

/** Every model the assembly holds, built once and disposed together. */
export interface CreatorModels {
  readonly surface: DesignSurface;
  readonly toolbox: Toolbox;
  readonly preview: PreviewSession;
  readonly json: JsonEditorSession;
  readonly translations: TranslationSession;
  readonly logic: LogicSession;
  readonly themeEditor: ThemeEditorSession;
}

/**
 * The models, built **once and never again**.
 *
 * `useState` with an initialiser rather than a `useMemo` over the props, and the difference
 * is not stylistic. A host writing `registry={new MetadataRegistry()}` inline — which is
 * exactly what somebody writes first — would hand a new object on every render, and a memo
 * keyed on it would rebuild the surface, the undo stack and the selection every time
 * anything on the page changed. The first version did, and a controlled-value test found it
 * by echoing `onChange` straight back.
 *
 * So the props below are read as they were on the first render. Changing the registry, the
 * parse seams or the translator mid-session is not a thing a host does; one who genuinely
 * needs to remounts with a different `key`, which is React's own way of saying "a different
 * document". `value` is the exception and goes through {@link useCreatorDocument}, because
 * swapping the *document* is a thing hosts do constantly.
 */
function useCreatorModels({
  value,
  registry,
  parse,
  translate,
  theme,
}: Pick<SurveyCreatorProps, 'value' | 'registry' | 'parse' | 'translate' | 'theme'>): CreatorModels {
  const [models] = useState<CreatorModels>(() => {
    const surface = new DesignSurface({ definition: value ?? {}, registry });
    return {
      surface,
      toolbox: new Toolbox(registry === undefined ? {} : { registry }),
      preview: new PreviewSession(surface, { registry, parse }),
      json: new JsonEditorSession(surface, { registry }),
      translations: new TranslationSession(surface, { registry, translate }),
      logic: new LogicSession(surface),
      themeEditor: new ThemeEditorSession(theme === undefined ? {} : { theme }),
    };
  });

  useEffect(
    () => () => {
      models.preview.dispose();
      models.json.dispose();
      models.translations.dispose();
      models.logic.dispose();
    },
    [models],
  );
  return models;
}

/**
 * The save controller, built once around whatever `save` is *now*.
 *
 * A controller rebuilt when the prop's identity changed would lose the state of a save in
 * flight — and `save={() => fetch(…)}` inline changes identity on every render. So the
 * controller is stable and calls through a ref, which is the same trap as the models above
 * and the same answer.
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
