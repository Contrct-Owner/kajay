export const DEFINITION_DIAGNOSTIC_DEFINITIONS = [
  {
    code: 'unknown-property',
    severity: 'warning',
    description: 'A property is not registered; it is preserved verbatim.',
  },
  {
    code: 'property-type-mismatch',
    severity: 'error',
    description: 'A registered property contains a value of the wrong JSON type.',
  },
  {
    code: 'invalid-child-collection',
    severity: 'error',
    description: 'A registered child collection is not an array.',
  },
  {
    code: 'invalid-element',
    severity: 'error',
    description: 'A child entry is neither an object nor an allowed scalar shorthand.',
  },
  {
    code: 'unknown-element-type',
    severity: 'error',
    description: 'A child declares a type that is not valid for its collection.',
  },
  {
    code: 'undeclared-endpoint',
    severity: 'error',
    description: 'A definition references a deployment endpoint the host did not supply.',
  },
  {
    code: 'invalid-pattern',
    severity: 'error',
    description: 'A validation pattern is outside Kajay Pattern Profile v1.',
  },
  {
    code: 'undeclared-host-value',
    severity: 'warning',
    description: 'An expression reads a host value the host did not supply.',
  },
  {
    code: 'reserved-name-sigil',
    severity: 'error',
    description: 'An element name starts with the sigil reserved for the host-value scope.',
  },
] as const;

export type DefinitionDiagnosticCode =
  (typeof DEFINITION_DIAGNOSTIC_DEFINITIONS)[number]['code'];
