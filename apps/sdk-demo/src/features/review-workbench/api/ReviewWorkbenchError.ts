export class ReviewWorkbenchError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ReviewWorkbenchError';
    this.status = status;
  }
}
