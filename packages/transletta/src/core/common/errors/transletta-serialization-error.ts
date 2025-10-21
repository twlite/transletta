import type { Translation } from '../../entities/translation.js';
import type { CompilationDiagnostic } from '../diagnostics.js';

export class TranslettaSerializationError extends Error {
  public constructor(
    private readonly translation: Translation,
    message: string,
    private readonly description: string,
  ) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }

  public getDiagnosticInfo(): CompilationDiagnostic {
    return {
      path: this.translation.path,
      name: this.translation.name,
      message: this.message,
      description: this.description,
    };
  }
}
