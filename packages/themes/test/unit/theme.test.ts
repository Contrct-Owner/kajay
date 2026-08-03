import { describe, expect, test } from 'vitest';
import {
  darkTheme,
  lightTheme,
  panellessTheme,
  themes,
  themeVariables,
} from '../../src/index.js';

describe('parity/I2-theme-format', () => {
  test('a theme becomes CSS custom properties and nothing else', () => {
    expect(themeVariables(lightTheme)).toEqual({
      '--kajay-color-surface': '#ffffff',
      '--kajay-color-text': '#101828',
      '--kajay-color-muted': '#667085',
      '--kajay-color-accent': '#2f6feb',
      '--kajay-color-border': '#d0d5dd',
      '--kajay-color-danger': '#b42318',
      '--kajay-color-background': '#f6f8fb',
      '--kajay-spacing': '16px',
      '--kajay-radius': '8px',
      '--kajay-panel-border-width': '1px',
      '--kajay-panel-padding': 'var(--kajay-spacing)',
    });
  });

  test('what a theme does not name, it does not set', () => {
    // The stylesheet already has a default for every token. Writing a guess over one
    // the theme never mentioned is how a partial theme turns into a broken one.
    expect(themeVariables({ name: 'accent-only', palette: { accent: '#ff0000' } })).toEqual({
      '--kajay-color-accent': '#ff0000',
    });
  });

  test('panelless is the absence of the frame, expressed as lengths', () => {
    const variables = themeVariables(panellessTheme);

    // Not a flag every panel rule would have to branch on: the border is zero and the
    // padding is gone, and no stylesheet rule knows the mode exists.
    expect(variables['--kajay-panel-border-width']).toBe('0');
    expect(variables['--kajay-panel-padding']).toBe('0');
  });

  test('a backdrop is a URL and an opacity, ready for CSS', () => {
    const variables = themeVariables({
      name: 'photo',
      backdrop: { image: 'https://example.com/hills.jpg', opacity: 0.2 },
    });

    expect(variables['--kajay-backdrop-image']).toBe('url("https://example.com/hills.jpg")');
    expect(variables['--kajay-backdrop-opacity']).toBe('0.2');
  });

  test('sizes are named rather than numeric, and map to spacing', () => {
    expect(themeVariables({ name: 'c', size: 'compact' })['--kajay-spacing']).toBe('12px');
    expect(themeVariables({ name: 'r', size: 'roomy' })['--kajay-spacing']).toBe('22px');
  });

  test('raw variables are the escape hatch, and win', () => {
    const variables = themeVariables({
      name: 'custom',
      cornerRadius: '8px',
      variables: { '--kajay-radius': '0', '--kajay-shadow': '0 1px 2px black' },
    });

    // A host with one unusual variable should not have to wait for the format to grow
    // a field for it — and when both say something, the explicit one is the later word.
    expect(variables['--kajay-radius']).toBe('0');
    expect(variables['--kajay-shadow']).toBe('0 1px 2px black');
  });

  test('the same theme always produces the same map', () => {
    // Pure, so a theme can be computed on a server, stored, diffed in a test, or handed
    // to a renderer, and mean the same thing every time.
    expect(themeVariables(darkTheme)).toEqual(themeVariables(darkTheme));
  });
});

describe('parity/I3-presets', () => {
  test('light and dark are both shipped, and differ where it matters', () => {
    expect(themes.map((theme) => theme.name)).toEqual(['light', 'dark', 'panelless']);
    expect(themeVariables(lightTheme)['--kajay-color-surface']).not.toBe(
      themeVariables(darkTheme)['--kajay-color-surface'],
    );
  });

  test('every preset names a full palette', () => {
    for (const theme of themes) {
      const variables = themeVariables(theme);
      // A preset that left a colour out would inherit whatever the last theme set,
      // which is how switching themes leaves one wrong colour behind.
      expect(Object.keys(variables)).toEqual(
        expect.arrayContaining([
          '--kajay-color-surface',
          '--kajay-color-text',
          '--kajay-color-accent',
          '--kajay-color-border',
          '--kajay-color-danger',
        ]),
      );
    }
  });
});
