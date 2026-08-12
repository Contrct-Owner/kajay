import { CreatorComponentsProvider, CreatorNotices, useCreatorWorkspace, usePreviewVersion } from '@kajay/creator-react';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { KAJAY_CREATOR_COMPONENTS } from '@/kajay/creatorComponents';
import { fetchPlaygroundChoices } from './choiceEndpoints';
import { EditorPane } from './EditorPane';
import type { EditorMode } from './EditorMode';
import { LivePane } from './LivePane';
import { PlaygroundHeader } from './PlaygroundHeader';
import { decodeDefinition } from './playgroundDocument';
import { STARTER_SURVEY } from './starterSurvey';

/**
 * The two panes are one document. The designer, JSON editor and live survey all derive
 * from one CreatorWorkspace, while the preview parses its own survey so respondent
 * answers never reach the definition being designed.
 */
export function PlaygroundWorkbench({
  encodedDefinition,
}: {
  readonly encodedDefinition: string | undefined;
}): ReactElement {
  // Read once: a share link is where the document came from, not a binding. Re-reading
  // would fight edits, while writing on every keystroke would flood browser history.
  const [opened] = useState(() => decodeDefinition(encodedDefinition) ?? STARTER_SURVEY);
  // The preview gets the host's seams, which is what makes `choicesByUrl` work here at
  // all: the library never fetches on its own, deliberately, so a playground that passed
  // nothing rendered an empty dropdown and no request. What it passes is allowlisted —
  // see `choiceEndpoints`, and note that a shared link is somebody else's browser.
  const workspace = useCreatorWorkspace({
    definition: opened,
    preview: { parse: { fetchJson: fetchPlaygroundChoices } },
  });
  const [mode, setMode] = useState<EditorMode>('design');
  usePreviewVersion(workspace.preview);

  return (
    <CreatorComponentsProvider components={KAJAY_CREATOR_COMPONENTS}>
      <PlaygroundHeader
        definition={workspace.surface.definition}
        mode={mode}
        onModeChange={setMode}
      />
      <CreatorNotices surface={workspace.surface} />
      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <EditorPane workspace={workspace} mode={mode} />
        <LivePane
          workspace={workspace}
          onRestart={() => {
            workspace.preview.restart();
          }}
        />
      </div>
    </CreatorComponentsProvider>
  );
}
