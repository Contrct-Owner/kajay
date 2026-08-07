export class DefinitionAuthoringError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'DefinitionAuthoringError';
    this.status = status;
  }
}
