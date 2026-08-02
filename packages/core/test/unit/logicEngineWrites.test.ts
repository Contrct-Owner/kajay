import { collectReferences, formatPath, parseExpression } from '@kajay/core';
import type { PathSegment } from '@kajay/core';
import { describe, expect, test } from 'vitest';
// Internal: the engine is reached through Survey by every host. These tests drive it
// directly because the behaviour under test — what happens when a rule writes somewhere
// it never declared — has no production rule yet, so no survey definition can provoke
// it. See the note on LogicRule.run.
import { LogicEngine } from '../../src/logic/LogicEngine.js';

function path(name: string): readonly PathSegment[] {
  return [{ kind: 'name', name }];
}

/** A resolver over a plain record, which is all the engine ever needs of the model. */
function resolverOver(values: Readonly<Record<string, unknown>>): (
  segments: readonly PathSegment[],
) => unknown {
  return (segments) => values[formatPath(segments)];
}

describe('rule writes reported to the transaction', () => {
  test('a write the rule declared does not re-enter: the graph already ordered it', () => {
    const engine = new LogicEngine();
    const evaluated: string[] = [];

    engine.addRule({
      key: 'writer',
      reads: collectReferences(parseExpression('{seed}').node),
      writes: path('answer'),
      run: () => {
        evaluated.push('writer');
        // Reporting its own declared write, exactly as createValueRule does.
        return [path('answer')];
      },
    });
    engine.addRule({
      key: 'reader',
      reads: collectReferences(parseExpression('{answer} notempty').node),
      run: () => {
        evaluated.push('reader');
      },
    });

    const result = engine.applyValueChange(path('seed'), resolverOver({ seed: 1 }));

    // One pass each. A declared write that re-entered would run `reader` twice.
    expect(evaluated).toEqual(['writer', 'reader']);
    expect(result.evaluated).toEqual(['writer', 'reader']);
    expect(result.dependencyErrors).toEqual([]);
  });

  test('a write the rule never declared re-enters, so its readers still run', () => {
    const engine = new LogicEngine();
    const evaluated: string[] = [];

    engine.addRule({
      key: 'writer',
      reads: collectReferences(parseExpression('{seed}').node),
      // No `writes`: the graph cannot order anything after this.
      run: () => {
        evaluated.push('writer');
        return [path('sideEffect')];
      },
    });
    engine.addRule({
      key: 'reader',
      reads: collectReferences(parseExpression('{sideEffect} notempty').node),
      run: () => {
        evaluated.push('reader');
      },
    });

    engine.applyValueChange(path('seed'), resolverOver({ seed: 1 }));

    expect(evaluated).toEqual(['writer', 'reader']);
  });

  test('a rule that writes nothing reports nothing', () => {
    const engine = new LogicEngine();
    let runs = 0;

    engine.addRule({
      key: 'observer',
      reads: collectReferences(parseExpression('{seed}').node),
      run: () => {
        runs += 1;
      },
    });

    const result = engine.applyValueChange(path('seed'), resolverOver({ seed: 1 }));
    expect(runs).toBe(1);
    expect(result.evaluated).toEqual(['observer']);
  });

  test('two rules feeding each other undeclared are bounded, not looped', () => {
    const engine = new LogicEngine();

    engine.addRule({
      key: 'ping',
      reads: collectReferences(parseExpression('{pong}').node),
      run: () => [path('pong')],
    });
    engine.addRule({
      key: 'pong',
      reads: collectReferences(parseExpression('{ping}').node),
      run: () => [path('ping')],
    });

    const result = engine.applyValueChange(path('ping'), resolverOver({}));

    // The report reaches the host through survey.logicDiagnostics rather than hanging
    // the tab, which is the whole point of bounding the cascade.
    expect(result.dependencyErrors.some((error) => error.code === 'cascade-limit')).toBe(true);
  });
});
