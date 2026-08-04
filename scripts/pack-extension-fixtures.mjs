/**
 * Installed-consumer proofs for public extension seams.
 *
 * These fragments are interpolated into the pack fixture after its imports. Keeping the
 * extension scenarios together makes the boundary under test visible without turning the
 * consumer's main smoke scenario into a grab bag.
 */
export const CORE_EXTENSION_SMOKE = `// Use a private registry: process-global defaults cannot hide a broken extension seam.
class PackedQuestion extends Question {
  override get type(): string {
    return 'packedquestion';
  }
}
class PackedAsyncValidator extends AsyncValidator {
  override get type(): string {
    return 'packedasyncvalidator';
  }

  override async validateAsync(_context: ValidationContext): Promise<SurveyError | undefined> {
    return undefined;
  }
}
class PackedValidator extends Validator {
  override get type(): string {
    return 'packedvalidator';
  }

  override validate({ value }: ValidationContext): SurveyError | undefined {
    return value === 'blocked' ? this.fail('Packed validator refused the value.') : undefined;
  }
}
class PackedRepeatingQuestion extends RepeatingQuestion {
  override get type(): string {
    return 'packedrepeatingquestion';
  }

  protected override get scopeName(): string {
    return 'packed';
  }

  override get rowKeys(): readonly string[] {
    return [];
  }

  override rowTitle(rowKey: string): string {
    return rowKey;
  }

  protected override rowPath(): readonly [] {
    return [];
  }

  protected override readRow(): Readonly<Record<string, unknown>> {
    return {};
  }

  protected override writeRow(): void {}

  protected override rowInstances(): readonly PageElement[] {
    return [];
  }
}
const isolatedRegistry = new MetadataRegistry();
registerBuiltInTypes(isolatedRegistry);
isolatedRegistry.addClass({
  name: 'packedquestion',
  parent: 'question',
  create: () => new PackedQuestion(),
});
isolatedRegistry.addClass({
  name: 'packedasyncvalidator',
  parent: 'validator',
  create: () => new PackedAsyncValidator(),
});
isolatedRegistry.addClass({
  name: 'packedvalidator',
  parent: 'validator',
  create: () => new PackedValidator(),
});
isolatedRegistry.addClass({
  name: 'packedrepeatingquestion',
  parent: 'question',
  create: () => new PackedRepeatingQuestion(),
});
const extended = parseSurvey(
  { pages: [{ name: 'custom-page', elements: [{ type: 'packedquestion', name: 'custom' }] }] },
  isolatedRegistry,
);
if (extended.survey.getQuestionByName('custom')?.type !== 'packedquestion') {
  throw new Error('A custom question could not be parsed through an isolated registry.');
}
if (!(isolatedRegistry.createInstance('packedasyncvalidator') instanceof AsyncValidator)) {
  throw new Error('A custom async validator could not be constructed through the registry.');
}
if (!(isolatedRegistry.createInstance('packedvalidator') instanceof Validator)) {
  throw new Error('A custom synchronous validator could not be constructed through the registry.');
}
if (!(isolatedRegistry.createInstance('packedrepeatingquestion') instanceof RepeatingQuestion)) {
  throw new Error('A custom repeating question could not be constructed through the registry.');
}

const functions = createDefaultFunctionRegistry();
functions.register('triple', ([value]) => Number(value) * 3);
const expression = parseExpression('triple({amount})');
const evaluated = evaluateExpression(expression.node, {
  getValue: createValueResolver({ amount: 7 }),
  functions,
  now: new Date('2026-08-04T00:00:00.000Z'),
});
if (expression.errors.length !== 0 || evaluated.errors.length !== 0 || evaluated.value !== 21) {
  throw new Error('A custom expression function could not be evaluated.');
}`;

export const RENDERER_EXTENSION_SMOKE = `const mutableRenderers: PageElementRendererRegistry = defaultPageElementRenderers.clone();
const rendererResolver: PageElementRendererResolver = defaultPageElementRenderers;
const surveyRenderers: SurveyProps['renderers'] = defaultPageElementRenderers;
mutableRenderers.register('packed-display', () => <div>packed</div>);
void surveyRenderers;
// @ts-expect-error Shared defaults are resolver-only; consumers extend a mutable clone.
defaultPageElementRenderers.register('must-not-compile', () => <div />);`;
