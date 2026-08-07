import type { ReactElement } from 'react';
import type { DefinitionActivationState } from '../api/DefinitionAuthoringTypes.js';
import { formatTimestamp, shortDigest } from './provenanceFormatting.js';

export function ActivationSummary({
  activation,
  environmentName,
}: {
  readonly activation: DefinitionActivationState;
  readonly environmentName: string;
}): ReactElement {
  return (
    <article className="activation-summary" aria-labelledby="activation-heading">
      <div>
        <p className="eyebrow">Environment activation</p>
        <h4 id="activation-heading">{environmentName}</h4>
      </div>
      {activation.releaseDigest === undefined ? (
        <p className="hint">No release is active in this environment.</p>
      ) : (
        <dl>
          <div><dt>Release</dt><dd>{activation.versionLabel ?? shortDigest(activation.releaseDigest)}</dd></div>
          <div><dt>Activation</dt><dd>v{activation.version}</dd></div>
          <div><dt>Activated by</dt><dd>{activation.activatedBy ?? 'Unknown'}</dd></div>
          <div><dt>Approved by</dt><dd>{activation.approvedBy ?? 'Not required'}</dd></div>
          <div><dt>Activated</dt><dd>{formatTimestamp(activation.activatedAt)}</dd></div>
        </dl>
      )}
    </article>
  );
}
