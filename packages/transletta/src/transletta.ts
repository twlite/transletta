import { TranslettaConfig } from './config/config';
import { TranslationScanner } from './core/scanner';

/**
 * The root class for the Transletta application.
 */
export class Transletta {
  /**
   * The file-system scanner to scan for translation files.
   */
  public readonly scanner: TranslationScanner;

  /**
   * Create a new Transletta instance.
   * @param config The Transletta configuration.
   */
  public constructor(readonly config: TranslettaConfig) {
    this.scanner = new TranslationScanner(this);
  }
}
