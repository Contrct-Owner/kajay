import test from 'node:test';
import { assertWorkspacePolicyRulesWork } from './workspacePolicySelfCheck.mjs';

test('workspace policy rejects topology drift and discovers TypeScript import forms', () => {
  assertWorkspacePolicyRulesWork();
});
