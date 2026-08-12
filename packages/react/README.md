# @kajay/react

React 19 renderer for survey models created by `@kajay/core`.

## Install

```bash
npm install @kajay/core @kajay/react @kajay/themes react
```

## Render

```tsx
import { parseSurvey } from '@kajay/core';
import { Survey } from '@kajay/react';
import '@kajay/themes/styles.css';

const { model } = parseSurvey(definition);

export function FeedbackSurvey() {
  return <Survey model={model} />;
}
```

Create the model outside render so React updates do not discard respondent state.
Hosts can replace renderer primitives and register custom question renderers through
the package-root extension seams.

## Documentation

- [Runtime quickstart](https://kajay.io/docs/quickstart/runtime)
- [Themes and components](https://kajay.io/docs/customization/themes-and-components)
- [Generated API reference](https://kajay.io/docs/reference/api/react)

MIT licensed. React is a peer dependency. See `CHANGELOG.md` for release history.
