import assert from 'node:assert/strict';
import test from 'node:test';
import { dotnetApiFacts } from './dotnetApiFacts.mjs';

test('C# API facts come from documented declarations checked by the baseline', () => {
  const source = `namespace Kajay;

/// <summary>Runs one survey session.</summary>
public sealed class Survey
{
}
`;
  assert.deepEqual(dotnetApiFacts([source], 'Kajay.Survey'), [{
    packageName: 'Kajay.Core',
    name: 'Survey',
    exportKind: 'type',
    classification: 'consumer',
    description: 'Runs one survey session.',
    signature: 'public sealed class Survey',
    gaps: [],
  }]);
});

test('C# API facts reject declarations missing from the compatibility baseline', () => {
  const source = 'namespace Kajay;\npublic enum SurveyState\n{\n}\n';
  assert.throws(
    () => dotnetApiFacts([source], ''),
    /Public C# type Kajay\.SurveyState is absent/u,
  );
});
