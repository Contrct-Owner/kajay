import { PREVIEW_DEVICES } from '@kajay/creator-core';
import type { CreatorStringKey, PreviewSession } from '@kajay/creator-core';
import { Survey } from '@kajay/react';
import type { SurveyProps } from '@kajay/react';
import type { CSSProperties, ReactElement } from 'react';
import { useCallback, useSyncExternalStore } from 'react';
import { useCreatorComponents } from './CreatorComponents.js';
import { useCreatorText } from './CreatorStringsContext.js';

export interface PreviewPanelProps {
  readonly session: PreviewSession;
  /**
   * Everything the host gives its *real* `<Survey>`: renderers, theme, sanitizer, classes.
   *
   * One passthrough rather than a mirrored prop each, so this stays right the day
   * `SurveyProps` grows — and so a preview cannot quietly drift into being a differently
   * configured survey from the one being previewed. A custom question type the host
   * registered renders here because the same registry is handed over, not because the
   * preview knows about it.
   */
  readonly surveyProps?: Omit<SurveyProps, 'model'>;
  readonly className?: string;
}

/**
 * The survey being designed, run — checklist M3.
 *
 * A piece ([ADR-0021](../../../docs/adr/0021-creator-composition.md)) like every other: it
 * takes the session and holds nothing, so a host can put it in a tab, a split pane, or a
 * second window.
 *
 * **The survey inside is the real `<Survey>`**, the component a respondent gets, with no
 * design-mode flag and nothing about the Creator reaching into it. That is what makes this
 * a preview rather than a second rendering of the canvas — and it is why the frame is a
 * plain sized box around it: the questions inside must lay themselves out against a width,
 * exactly as they will in a browser that happens to be that wide.
 */
export function PreviewPanel({
  session,
  surveyProps,
  className,
}: PreviewPanelProps): ReactElement {
  usePreviewVersion(session);

  return (
    <div className={joinClasses('kajay-preview', className)}>
      <PreviewControls session={session} />
      <StaleNotice session={session} />
      <div className="kajay-preview__frame" style={frameStyle(session)} data-testid="preview-frame">
        {/* Keyed on the *run*, not the version: a restart should be a fresh mount rather
            than React reconciling a half-answered page into a new survey's first one, but
            changing the device or typing the first answer must not disturb anything. */}
        <Survey key={session.run} model={session.survey} {...surveyProps} />
      </div>
    </div>
  );
}

/**
 * The viewport, as a real width.
 *
 * `undefined` on an axis means "fill what it is given", so the style simply omits it and
 * the frame is whatever the host's layout makes it — which is what the responsive preset
 * is. A zero would have been a size.
 */
function frameStyle(session: PreviewSession): CSSProperties {
  const { width, height } = session.viewport;
  return {
    ...(width === undefined ? {} : { width: `${String(width)}px` }),
    ...(height === undefined ? {} : { height: `${String(height)}px` }),
  };
}

/** The catalogue key each shipped device is named by — checklist N3. */
const DEVICE_KEYS: Readonly<Record<string, CreatorStringKey | undefined>> = {
  responsive: 'deviceResponsive',
  phone: 'devicePhone',
  tablet: 'deviceTablet',
  desktop: 'deviceDesktop',
};

/** Which device, which way round, and starting again. */
function PreviewControls({ session }: { readonly session: PreviewSession }): ReactElement {
  const { Button, Select } = useCreatorComponents();
  const text = useCreatorText();
  const isPortrait = session.orientation === 'portrait';

  return (
    <div className="kajay-preview__controls">
      <Select
        className="kajay-preview__device"
        aria-label={text('previewDevice')}
        data-testid="preview-device"
        value={session.device.name}
        // Device names are the Creator's own words, so they come from the catalogue —
        // the shipped `title` is the fallback for a host's own device that has no key.
        options={PREVIEW_DEVICES.map((device) => ({
          value: device.name,
          label: DEVICE_KEYS[device.name] === undefined ? device.title : text(DEVICE_KEYS[device.name]!),
        }))}
        onValueChange={(name) => {
          session.setDevice(name);
        }}
      />
      <Button
        className="kajay-preview__rotate"
        data-testid="preview-rotate"
        // Pressed rather than a label that changes: which way round it is now is the state,
        // and a button reading "Landscape" is ambiguous about whether that is what it is or
        // what it would do.
        aria-pressed={!isPortrait}
        onClick={() => {
          session.setOrientation(isPortrait ? 'landscape' : 'portrait');
        }}
      >
        {text('previewRotate')}
      </Button>
      <Button
        className="kajay-preview__restart"
        data-testid="preview-restart"
        onClick={() => {
          session.restart();
        }}
      >
        {text('previewRestart')}
      </Button>
    </div>
  );
}

/**
 * Says when the run is behind the design, and only then.
 *
 * A run with nothing answered has already followed the edit, so this appears exactly when
 * following it would have thrown something away — which is the one case where a designer
 * needs to decide rather than be told.
 */
function StaleNotice({ session }: { readonly session: PreviewSession }): ReactElement | null {
  const text = useCreatorText();
  if (!session.isStale) {
    return null;
  }
  return (
    // `aria-live` on its own, not `role="status"`: a status role is something a page-wide
    // `getByRole('status')` finds, and K2 learned the hard way that a second one broke
    // seven scenarios with nothing to do with the piece that added it.
    <p
      className="kajay-preview__stale"
      aria-live="polite"
      aria-atomic="true"
      data-testid="preview-stale"
    >
      {text('previewStale')}
    </p>
  );
}

/**
 * Re-renders when the session changes: the device, the run, whether it is stale.
 *
 * The same `useSyncExternalStore` shape as `useSurfaceVersion`, over a different model.
 * Answers inside the survey are `<Survey>`'s own business and do not come through here.
 */
export function usePreviewVersion(session: PreviewSession): number {
  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => session.onChanged.add(onStoreChange),
    [session],
  );
  const getSnapshot = useCallback((): number => session.version, [session]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

function joinClasses(base: string, extra: string | undefined): string {
  return extra === undefined || extra.length === 0 ? base : `${base} ${extra}`;
}
