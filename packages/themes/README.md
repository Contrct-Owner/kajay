# @kajay/themes

Dependency-free CSS variables, stylesheets, and JSON theme presets for Kajay surveys
and the Creator.

## Install and use

```bash
npm install @kajay/themes
```

```ts
import { darkTheme, themeVariables } from '@kajay/themes';
import '@kajay/themes/styles.css';

const variables = themeVariables(darkTheme);
```

Preset stylesheets are also exported from `@kajay/themes/themes/*.css`. Applications
import CSS explicitly; no runtime package injects styles or depends on this package.

## Documentation

- [Themes and design-system components](https://kajay.io/docs/customization/themes-and-components)
- [Design-token contract](https://github.com/Contrct-Owner/kajay/blob/main/docs/design-tokens.md)
- [Generated API reference](https://kajay.io/docs/reference/api/themes)

MIT licensed. See `CHANGELOG.md` for release history.
