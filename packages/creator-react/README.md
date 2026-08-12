# @kajay/creator-react

React 19 UI for `@kajay/creator-core`, including the default `SurveyCreator` assembly
and the public panels used to compose a host-owned layout.

## Install

```bash
npm install @kajay/core @kajay/react @kajay/creator-core @kajay/creator-react @kajay/themes react
```

```tsx
import { SurveyCreator } from '@kajay/creator-react';
import '@kajay/themes/styles.css';

export function Designer() {
  return <SurveyCreator value={definition} onChange={setDefinition} />;
}
```

Use `SurveyCreator` for the maintained assembly or arrange the exported panels around
one shared `CreatorWorkspace`. Hosts may replace the component map, wording, property
editors, and notice presentation without importing package internals.

## Documentation

- [Creator quickstart](https://kajay.io/docs/quickstart/creator)
- [Creator configuration](https://kajay.io/docs/creator/configuration)
- [Generated API reference](https://kajay.io/docs/reference/api/creator-react)

Source-available under FSL-1.1-ALv2. See `CHANGELOG.md` for release history.
