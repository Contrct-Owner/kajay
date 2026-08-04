import { MetadataRegistry, Question, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { CreatorWorkspace } from '@kajay/creator-core';
import type { CreatorConfiguration } from '@kajay/creator-core';
import { describe, expect, test } from 'vitest';

class WorkspaceNote extends Question {
  override get type(): string {
    return 'workspace-note';
  }
}

function registry(): MetadataRegistry {
  const made = new MetadataRegistry();
  registerBuiltInTypes(made);
  made.addClass({
    name: 'workspace-note',
    parent: 'question',
    create: () => new WorkspaceNote(),
  });
  return made;
}

const DEFINITION: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [{ type: 'workspace-note', name: 'note', title: 'A shared note' }],
    },
  ],
};

describe('CreatorWorkspace', () => {
  test('constructs every model from one registry and configuration', () => {
    const configuration: CreatorConfiguration = { allowedTypes: ['workspace-note'] };
    const workspace = new CreatorWorkspace({
      definition: DEFINITION,
      registry: registry(),
      configuration,
      preview: { device: 'phone', data: { note: 'seeded' } },
      json: { indent: 4 },
      themeEditor: { theme: { name: 'host-theme' } },
    });

    expect(workspace.surface.configuration).toBe(configuration);
    expect(workspace.toolbox.items.map((item) => item.type)).toEqual(['workspace-note']);
    expect(workspace.preview.diagnostics).toEqual([]);
    expect(workspace.preview.device.name).toBe('phone');
    expect(workspace.preview.data['note']).toBe('seeded');
    expect(workspace.json.diagnostics).toEqual([]);
    expect(workspace.json.text).toContain('\n    "pages"');
    expect(workspace.translations.entries.map((entry) => entry.value)).toContain(
      'A shared note',
    );
    expect(workspace.themeEditor.theme['name']).toBe('host-theme');

    workspace.dispose();
  });

  test('all following sessions observe the same document', () => {
    const workspace = new CreatorWorkspace({ definition: DEFINITION, registry: registry() });
    const before = {
      preview: workspace.preview.version,
      json: workspace.json.version,
      translations: workspace.translations.version,
      logic: workspace.logic.version,
    };

    workspace.surface.setTitle(workspace.surface.survey.getQuestionByName('note')!, 'Changed');

    expect(workspace.preview.version).toBeGreaterThan(before.preview);
    expect(workspace.preview.survey.getQuestionByName('note')?.title).toBe('Changed');
    expect(workspace.json.version).toBeGreaterThan(before.json);
    expect(workspace.json.text).toContain('Changed');
    expect(workspace.translations.version).toBeGreaterThan(before.translations);
    expect(workspace.translations.entries.map((entry) => entry.value)).toContain('Changed');
    expect(workspace.logic.version).toBeGreaterThan(before.logic);

    workspace.dispose();
  });

  test('disposal is terminal and idempotent', () => {
    const workspace = new CreatorWorkspace({ definition: DEFINITION, registry: registry() });
    expect(workspace.surface.onChanged.listenerCount).toBe(4);

    workspace.dispose();
    expect(workspace.surface.onChanged.listenerCount).toBe(0);
    const stopped = {
      preview: workspace.preview.version,
      json: workspace.json.version,
      translations: workspace.translations.version,
      logic: workspace.logic.version,
    };

    workspace.surface.setTitle(workspace.surface.survey.getQuestionByName('note')!, 'After');
    workspace.dispose();

    expect(workspace.surface.onChanged.listenerCount).toBe(0);
    expect(workspace.preview.version).toBe(stopped.preview);
    expect(workspace.json.version).toBe(stopped.json);
    expect(workspace.translations.version).toBe(stopped.translations);
    expect(workspace.logic.version).toBe(stopped.logic);
  });
});
