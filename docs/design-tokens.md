# Design Tokens

- Area: Theming contract for `@kajay/themes`
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-03

Every visual decision the library makes is a CSS custom property. This is the list, and
it is the whole styling contract: a host that sets these controls the look of a survey
without overriding a single rule, and a host that wants more writes ordinary CSS against
the class names, which are stable.

Three ways to set them, all the same mechanism
([ADR-0008](./adr/0008-css-variable-token-system.md)):

1. **A stylesheet.** `import "@kajay/themes/styles.css"` for the defaults, then override
   whichever tokens you like in your own CSS.
2. **A preset.** `import "@kajay/themes/themes/dark.css"` scopes a preset to anything
   marked `data-kajay-theme="dark"`.
3. **A theme object, at runtime.** `themeVariables(darkTheme)` returns the map below;
   hand it to `<Survey theme={…} />` and it applies to that survey and nothing else.

The third is what makes a theme switcher, a per-tenant look, or two differently themed
surveys on one page possible. `@kajay/react` never imports `@kajay/themes` — it takes a
plain map — so nothing about theming is load-bearing for rendering.

## Colour

| Token | Default | What it colours |
| --- | --- | --- |
| `--kajay-color-surface` | `#ffffff` | The survey card, inputs, panels |
| `--kajay-color-text` | `#101828` | Body text |
| `--kajay-color-muted` | `#667085` | Descriptions, counters, hints, row and column headers |
| `--kajay-color-accent` | `#2f6feb` | The primary button, focus rings, the selected state, the required marker |
| `--kajay-color-border` | `#d0d5dd` | Every border and divider |
| `--kajay-color-danger` | `#b42318` | Validation messages and the fields they belong to |
| `--kajay-color-background` | `#f6f8fb` | Behind the survey. Set by a theme for a host that wants it; the library paints nothing outside its own card |

**Colour is never the only cue.** An invalid field carries `aria-invalid` and a message
in words; the danger colour is the echo. A selected tab says `aria-selected`. Changing
these tokens cannot make the survey unusable to somebody who does not perceive the
difference, because nothing depends on the difference alone.

## Shape and space

| Token | Default | Effect |
| --- | --- | --- |
| `--kajay-radius` | `8px` | Corner radius, everywhere |
| `--kajay-spacing` | `16px` | The one spacing unit. Everything else is a fraction or multiple of it |
| `--kajay-font-family` | system stack | Type for the whole survey |

`--kajay-spacing` is the only spacing value in the stylesheet. A rule that wanted half a
gap says `calc(var(--kajay-spacing) / 2)` rather than `8px`, so changing one token
rescales the survey coherently instead of leaving some gaps behind.

## Panels

| Token | Default | Effect |
| --- | --- | --- |
| `--kajay-panel-border-width` | `1px` | The frame around panels and repeating-panel instances |
| `--kajay-panel-padding` | `var(--kajay-spacing)` | Inside that frame |

"Panelless" is these two set to zero rather than a mode flag. No rule in the stylesheet
knows the mode exists, which is why it cannot be half-applied.

## Backdrop

| Token | Default | Effect |
| --- | --- | --- |
| `--kajay-backdrop-image` | `none` | A picture behind the survey |
| `--kajay-backdrop-opacity` | `1` | How much of it shows through |

The backdrop is its own layer under the content, so the opacity applies to the picture
and **not** to the text in front of it — the reason it is not simply the survey's
`background-image`.

## Adding a token

A new token is a change to this document, to `styles.css`, and — if a theme should be
able to set it structurally rather than through `variables` — to the `Theme` format. In
that order: the contract first, so a token never exists only as an implementation detail
somebody else has to discover.
