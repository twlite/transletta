import { join } from 'node:path';
import { Transletta } from '../../transletta.js';
import { readdir, readFile } from 'node:fs/promises';
import { type SerializedTranslation, Translation } from '../entities/translation.js';
import { Collection } from '../common/collection.js';
import type { CacheableManager } from './common.js';
import { TranslettaSerializationError } from '../common/errors/transletta-serialization-error.js';
import type { CompilationDiagnostic } from '../common/diagnostics.js';

/**
 * The compiled translations.
 */
export type CompiledTranslations = Collection<string, SerializedTranslation[]>;

/**
 * The options for compiling the translations.
 */
export interface CompileOptions {
  /**
   * Whether to force a new compilation.
   * @default false
   */
  force?: boolean;
  /**
   * Whether to include diagnostic information in the compilation result.
   * Enabling this captures errors and warnings that occurred during the compilation process.
   * @default false
   */
  diagnostics?: boolean;
}

/**
 * The result of a translation compilation.
 */
export interface CompilationResult {
  /**
   * The compiled translations.
   */
  result: CompiledTranslations;
  /**
   * The diagnostic information from the compilation.
   */
  diagnostics: CompilationDiagnostic[];
}

/**
 * The translation manager to manage the translations.
 */
export class TranslationManager implements CacheableManager<string, Collection<string, Translation>>, Disposable {
  /**
   * The translations map by locale and category.
   */
  public readonly cache = new Collection<string, Collection<string, Translation>>();

  /**
   * The result of the last compilation.
   */
  private compilationResult: CompiledTranslations = new Collection();

  /**
   * Create a new file-system scanner.
   * @param transletta The Transletta instance.
   */
  public constructor(readonly transletta: Transletta) {}

  /**
   * Scan the file-system for translation files.
   * @param force Whether to force a new scan.
   */
  public async scan(force = false) {
    if (!force && this.cache.size > 0) {
      return;
    }

    this.cache.clear();

    const rootDir = this.transletta.getInputDirectory();
    const outputDir = this.transletta.getOutputDirectory();

    const contents = await readdir(rootDir, {
      withFileTypes: true,
    });

    for (const entry of contents) {
      if (!entry.isDirectory()) continue;

      const localeDir = join(entry.parentPath, entry.name);

      // ignore output directory and files starting with . or _
      if (entry.name.startsWith('.') || entry.name.startsWith('_') || localeDir === outputDir) {
        continue;
      }

      const locale = entry.name;
      const localeFiles = await readdir(localeDir, {
        withFileTypes: true,
      });
      const localeTranslations = this.cache.upsert(locale, () => new Collection<string, Translation>());

      for (const file of localeFiles) {
        if (!file.isFile() || !file.name.endsWith('.toml')) continue;

        const filePath = join(localeDir, file.name);
        const content = await readFile(filePath, 'utf-8');
        const name = file.name.replace(/\.toml$/, '');
        const translation = new Translation(this, {
          content,
          locale,
          name,
          path: filePath,
        });

        localeTranslations.set(translation.name, translation);
      }
    }
  }

  /**
   * Compiles the loaded translations into consumable JSON objects
   * @param options The options for compiling the translations.
   * @returns The compiled translations.
   */
  public compile(options: CompileOptions = {}): CompilationResult {
    const { force = false, diagnostics = false } = options;

    if (!force && this.compilationResult.size > 0) {
      return {
        result: this.compilationResult,
        diagnostics: [],
      };
    }

    this.compilationResult.clear();

    const diagnosticsData: CompilationDiagnostic[] = [];

    this.cache.forEach((translations, locale) => {
      const serializedTranslations = translations
        .map((translation) => {
          try {
            return translation.serialize();
          } catch (error) {
            if (error instanceof TranslettaSerializationError) {
              diagnosticsData.push(error.getDiagnosticInfo());
              return null;
            }

            // not the kind of error we expected, rethrow
            throw error;
          }
        })
        .filter((value) => value !== null);

      this.compilationResult.set(locale, serializedTranslations);
    });

    return {
      result: this.compilationResult,
      diagnostics: diagnosticsData,
    };
  }

  /**
   * Cleanup the translation manager resources.
   */
  public clear() {
    this.cache.forEach((translations) => translations.clear());
    this.cache.clear();
    this.compilationResult.clear();
  }

  /**
   * Dispose the translation manager resources.
   */
  public [Symbol.dispose]() {
    return this.clear();
  }
}
