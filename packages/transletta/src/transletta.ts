import { join } from 'node:path';
import type { TranslettaConfig } from './config/config.js';
import { type CompiledTranslations, TranslationManager } from './core/managers/translation-manager.js';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';

/**
 * The root class for the Transletta application.
 */
export class Transletta implements Disposable {
  /**
   * The file-system scanner to scan for translation files.
   */
  public readonly translations: TranslationManager;

  /**
   * Create a new Transletta instance.
   * @param config The Transletta configuration.
   */
  public constructor(readonly config: TranslettaConfig) {
    this.translations = new TranslationManager(this);
  }

  /**
   * Get the input directory for the translations.
   * @returns The input directory.
   */
  public getInputDirectory(): string {
    return join(process.cwd(), this.config.input);
  }

  /**
   * Get the output directory for the compiled translations.
   * @returns The output directory.
   */
  public getOutputDirectory(): string {
    return join(process.cwd(), this.config.output);
  }

  /**
   * Compile the translation resources.
   */
  public async compile(): Promise<CompiledTranslations> {
    await this.translations.scan(true);
    const result = this.translations.compile({
      force: true,
      diagnostics: true,
    });

    if (result.diagnostics.length > 0) {
      const errorMessages = result.diagnostics
        .map(
          (diagnostic, i) =>
            `${i + 1}. Failed to compile translation ${diagnostic.name} at ${diagnostic.path}:\nError: ${diagnostic.message}\n\nDescription: ${diagnostic.description}`,
        )
        .join(`\n${'-'.repeat(80)}\n\n`);

      result.result.clear();

      throw new Error(`Compilation failed with ${result.diagnostics.length} errors:\n${errorMessages}`);
    }

    return result.result;
  }

  /**
   * Emit the compiled changes to the output directory.
   * @param resource The compiled translations to emit.
   */
  public async emit(resource: CompiledTranslations) {
    const outputDir = this.getOutputDirectory();

    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }

    for (const [locale, translations] of resource.entries()) {
      const localeDir = join(outputDir, locale);

      if (!existsSync(localeDir)) {
        await mkdir(localeDir, { recursive: true });
      }

      for (const translation of translations) {
        const filePath = join(localeDir, translation.metadata.name + '.json');
        await writeFile(filePath, JSON.stringify(translation.content, null, 2));
      }
    }
  }

  /**
   * Cleanup the Transletta instance resources.
   */
  public cleanup() {
    return this.translations.clear();
  }

  /**
   * Dispose the Transletta instance resources.
   */
  public [Symbol.dispose]() {
    return this.cleanup();
  }
}
