/**
 * The viewports a designer can preview in — checklist M3.
 *
 * **In the Creator, not in the theme or the renderer**, for the reason
 * [`builtInToolbox`](./builtInToolbox.ts) gives about drawers: "what does a phone measure"
 * is a fact about the tool a designer is using, not about the survey. A respondent's
 * browser is whatever size it is, and the runtime has never had an opinion about that.
 *
 * The sizes are CSS pixels — the units `width` and `minWidth` are authored in (I5) — so a
 * question that fits at 375 fits on a phone, rather than fitting in a picture of one.
 */

export interface PreviewDevice {
  readonly name: string;
  readonly title: string;
  /**
   * The viewport in CSS pixels, in portrait. Absent means "as wide as it is given".
   *
   * Optional rather than a zero sentinel, because "no fixed width" is a different kind of
   * answer from "zero wide" and a reader that treats them as one is a reader that will
   * eventually divide by it.
   */
  readonly width?: number;
  readonly height?: number;
}

/** Which way round a device's two measurements go. */
export type PreviewOrientation = 'portrait' | 'landscape';

/**
 * The shipped presets, in the order a picker offers them.
 *
 * **Responsive is first and is the default**, because it is what the designer is already
 * looking at: the canvas fills its panel, and a preview that opened at 375 would make
 * every survey look like it had a mobile problem it does not have. The fixed sizes are for
 * *asking a question* — "does this fit on a phone" — which is a thing a designer does
 * deliberately.
 *
 * Every device rotates, including the desktop. Refusing there would be tidy and wrong: a
 * portrait monitor is a real thing people fill in forms on, and there is nothing to gain
 * by having the tool disbelieve in it.
 */
export const PREVIEW_DEVICES: readonly PreviewDevice[] = [
  { name: 'responsive', title: 'Responsive' },
  { name: 'phone', title: 'Phone', width: 375, height: 667 },
  { name: 'tablet', title: 'Tablet', width: 768, height: 1024 },
  { name: 'desktop', title: 'Desktop', width: 1280, height: 800 },
];

/** The first preset, which is what a session opens in. */
export const DEFAULT_PREVIEW_DEVICE = 'responsive';

/** A device by name, or the default when nothing answers to it. */
export function previewDevice(name: string): PreviewDevice {
  return (
    PREVIEW_DEVICES.find((device) => device.name === name) ??
    PREVIEW_DEVICES.find((device) => device.name === DEFAULT_PREVIEW_DEVICE) ??
    { name, title: name }
  );
}

/** What a frame should measure. `undefined` on either axis means "fill". */
export interface PreviewViewport {
  readonly width: number | undefined;
  readonly height: number | undefined;
}

/**
 * A device's measurements with its orientation applied.
 *
 * Rotating is swapping the two numbers, which is the whole of it — a device has one size
 * and two ways round, and storing both would be two places for one fact to be wrong.
 */
export function previewViewport(
  device: PreviewDevice,
  orientation: PreviewOrientation,
): PreviewViewport {
  if (orientation === 'portrait') {
    return { width: device.width, height: device.height };
  }
  return { width: device.height, height: device.width };
}
