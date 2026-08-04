/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import type { CreatorWorkspaceOptions } from '@kajay/creator-core';
import { useCreatorWorkspace } from '@kajay/creator-react';
import { StrictMode } from 'react';
import type { PropsWithChildren, ReactElement } from 'react';
import { expect, test } from 'vitest';
import { renderHook } from 'vitest-browser-react';

const FIRST: SurveyDefinition = {
  pages: [{ name: 'p1', elements: [{ type: 'text', name: 'first', title: 'First' }] }],
};

const SECOND: SurveyDefinition = {
  pages: [{ name: 'p2', elements: [{ type: 'comment', name: 'second', title: 'Second' }] }],
};

function registry(): MetadataRegistry {
  const made = new MetadataRegistry();
  registerBuiltInTypes(made);
  return made;
}

function StrictModeWrapper({ children }: PropsWithChildren): ReactElement {
  return <StrictMode>{children}</StrictMode>;
}

test('useCreatorWorkspace survives StrictMode replay and owns final unmount cleanup', async () => {
  const initialOptions: CreatorWorkspaceOptions = {
    definition: FIRST,
    registry: registry(),
  };
  const hook = await renderHook(
    (props) => useCreatorWorkspace(props?.options ?? initialOptions),
    {
      initialProps: { options: initialOptions },
      wrapper: StrictModeWrapper,
    },
  );
  const workspace = hook.result.current;

  // StrictMode has already run setup, synthetic cleanup, then setup. A terminal cleanup
  // during that replay would leave all four following sessions disconnected here.
  expect(workspace.surface.onChanged.listenerCount).toBe(4);
  const previewVersion = workspace.preview.version;
  workspace.surface.setTitle(workspace.surface.survey.getQuestionByName('first')!, 'Changed');
  expect(workspace.preview.version).toBeGreaterThan(previewVersion);
  expect(workspace.json.text).toContain('Changed');

  // Initialization seams are fixed for a mount. Documents are changed through the surface
  // (the default assembly does so with useCreatorDocument), not by rebuilding the graph.
  await hook.rerender({ options: { definition: SECOND, registry: registry() } });
  expect(hook.result.current).toBe(workspace);
  expect(workspace.surface.survey.getQuestionByName('first')).toBeDefined();
  expect(workspace.surface.survey.getQuestionByName('second')).toBeUndefined();

  await hook.unmount();
  await Promise.resolve();
  expect(workspace.surface.onChanged.listenerCount).toBe(0);

  const stoppedVersion = workspace.preview.version;
  workspace.surface.setTitle(workspace.surface.survey.getQuestionByName('first')!, 'After');
  expect(workspace.preview.version).toBe(stoppedVersion);
  workspace.dispose();
});
