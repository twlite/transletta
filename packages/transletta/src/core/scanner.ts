import { Transletta } from '../transletta';

/**
 * The file-system scanner to scan for translation files.
 */
export class TranslationScanner {
  /**
   * Create a new file-system scanner.
   * @param transletta The Transletta instance.
   */
  public constructor(readonly transletta: Transletta) {}

  /**
   * Scan the file-system for translation files.
   */
  public scan() {}
}
