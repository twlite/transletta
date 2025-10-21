export interface CompilationDiagnostic {
  /**
   * The path to the translation file that caused the error.
   */
  path: string;
  /**
   * The name of the translation that caused the error.
   */
  name: string;
  /**
   * The error message.
   */
  message: string;
  /**
   * The description for this diagnostic.
   */
  description: string;
}
