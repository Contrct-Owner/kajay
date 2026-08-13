import { CreatorComponentsProvider, CreatorNotices, useCreatorWorkspace, usePreviewVersion } from '@kajay/creator-react';
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { CreatorWorkspace } from '@kajay/creator-core';
import { KAJAY_CREATOR_COMPONENTS } from '@/kajay/creatorComponents';
import { fetchPlaygroundChoices } from './choiceEndpoints';
import { EditorPane } from './EditorPane';
import type { EditorMode } from './EditorMode';
import { LivePane } from './LivePane';
import { PlaygroundHeader } from './PlaygroundHeader';
import { HostContextPanel } from './HostContextPanel';
import { HOST_CONTEXT_EXAMPLE } from './hostContextExample';
import { decodeDefinition } from './playgroundDocument';
import { PLAYGROUND_HOST_VALUES, type PlaygroundHostValues } from './playgroundHostValues';
import { STARTER_SURVEY } from './starterSurvey';


/**
 * Everything on the respondent's side of the playground: the survey, and the application
 * standing behind it. One component because they are one story — a host value only means
 * anything next to the survey reacting to it.
 */
function RespondentColumn({
  workspace,
  hostValues,
  onHostValuesChange,
}: {
  readonly workspace: CreatorWorkspace;
  readonly hostValues: PlaygroundHostValues;
  readonly onHostValuesChange: (values: PlaygroundHostValues) => void;
}): ReactElement {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <LivePane
        workspace={workspace}
        onRestart={() => {
          workspace.preview.restart();
        }}
      />
      <HostContextPanel
        values={hostValues}
        onChange={onHostValuesChange}
        onLoadExample={() => {
          // Through the same chokepoint every structural edit uses, so loading the example
          // is undoable and the JSON view follows it like any other edit.
          workspace.surface.applyEdit(HOST_CONTEXT_EXAMPLE);
          workspace.preview.restart();
        }}
      />
    </div>
  );
}

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
  const [hostValues, setHostValues] = useState(PLAYGROUND_HOST_VALUES);
  const workspace = useCreatorWorkspace({
    definition: opened,
    // The canvas has no host, so it is told the *names* only. Without this a definition
    // reading `{$tier}` is reported as broken for depending on something no canvas can
    // supply, and the playground's own document would open with two warnings on it.
    hostValueNames: Object.keys(PLAYGROUND_HOST_VALUES),
    // Seeded rather than left empty, because a share link carries the definition and
    // nothing else: a survey whose conditions read the host scope has to work on arrival.
    preview: {
      parse: { fetchJson: fetchPlaygroundChoices, values: PLAYGROUND_HOST_VALUES },
    },
  });
  const [mode, setMode] = useState<EditorMode>('design');
  usePreviewVersion(workspace.preview);
  const preview = workspace.preview.survey;
  // Two jobs in one effect, because they are one rule: whatever the panel says is what
  // this survey is told. A restart re-parses from the seed above and hands back a *new*
  // survey, so without re-applying here a visitor who restarts would silently drop back
  // to bronze while the panel still read gold.
  useEffect(() => {
    for (const [name, value] of Object.entries(hostValues)) {
      preview.setHostValue(name, value);
    }
  }, [preview, hostValues]);

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
        <RespondentColumn
          workspace={workspace}
          hostValues={hostValues}
          onHostValuesChange={setHostValues}
        />
      </div>
    </CreatorComponentsProvider>
  );
}
