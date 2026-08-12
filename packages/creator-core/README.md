# @kajay/creator-core

Headless TypeScript authoring model for Kajay survey definitions. It provides the
Creator workspace, design surface, toolbox, property grid, history, JSON, logic,
translation, theme, preview, and save sessions without a DOM dependency.

## Install

```bash
npm install @kajay/core @kajay/creator-core
```

```ts
import { CreatorWorkspace } from '@kajay/creator-core';

const workspace = new CreatorWorkspace({ definition });
workspace.surface.addPage();
const currentDefinition = workspace.surface.definition;
workspace.dispose();
```

One workspace owns one coherent document and its sessions. Use the React package for
the maintained UI assembly, or consume these headless models from another adapter.

## Documentation

- [Embed the Creator](https://kajay.io/docs/quickstart/creator)
- [Creator composition](https://kajay.io/docs/creator/composition)
- [Generated API reference](https://kajay.io/docs/reference/api/creator-core)

Source-available under FSL-1.1-ALv2. See `CHANGELOG.md` for release history.
