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
| `--kajay-color-on-accent` | `#ffffff` | Text and glyphs *on* the accent. Its own token because it does not follow from the accent: a dark theme lightens the accent to show against a dark surface, and that is exactly when white stops being readable |
| `--kajay-color-border` | `#d0d5dd` | Every border and divider |
| `--kajay-color-danger` | `#b42318` | Validation messages and the fields they belong to |
| `--kajay-color-background` | `#f6f8fb` | Behind the survey. Set by a theme for a host that wants it; the library paints nothing outside its own card |

Contrast is a property of the palette rather than of a rule, so the accessibility sweep
runs once per shipped theme. It has already earned its keep: the dark preset's primary
button was white on a light accent at 2.51:1 until `--kajay-color-on-accent` existed.

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

## Classes without tokens

Two parts are styled but have nothing a theme should set: `.kajay-timer` (E8's timer
panel) frames itself with the panel border and spacing tokens above, and
`.kajay-timer__value` sets `font-variant-numeric: tabular-nums` so a countdown does not
jitter sideways as the seconds tick over. Neither is a decision a theme takes — the
first is already the panel's, and the second is wrong in every theme if it is wrong at
all. A host that disagrees overrides the class.

## Direction

There is no token for it. A right-to-left survey is a `dir` attribute on the survey
root, and every rule in the stylesheet uses **logical** properties — `inline-start`,
`start`, `end` — so the browser mirrors the layout. A rule that says `left` is a bug in
Arabic that nobody sees while reading English; a host adding CSS should follow the same
habit.

## Adding a token

A new token is a change to this document, to `styles.css`, and — if a theme should be
able to set it structurally rather than through `variables` — to the `Theme` format. In
that order: the contract first, so a token never exists only as an implementation detail
somebody else has to discover.
