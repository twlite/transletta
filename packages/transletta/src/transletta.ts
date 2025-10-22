import { join } from 'node:path';
import type { TranslettaConfig } from './config/config.js';
import { type CompiledTranslations, TranslationManager } from './core/managers/translation-manager.js';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createDtsGenerator } from './core/dts/factory.js';

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
   * Check if the workspace mode is enabled.
   * @returns True if the workspace mode is enabled, false otherwise.
   */
  public isWorkspaceMode(): boolean {
    return this.config.projects !== null;
  }

  /**
   * Get the workspace projects.
   * @returns The workspace projects.
   */
  public getWorkspaceProjects(): Record<string, string> {
    return this.config.projects ?? {};
  }

  /**
   * Check if the workspace is empty.
   * @returns True if the workspace is empty, false otherwise.
   */
  public isWorkspaceEmpty(): boolean {
    return Object.keys(this.getWorkspaceProjects()).length === 0;
  }

  /**
   * Compile the translation resources.
   */
  public async compile(): Promise<CompiledTranslations> {
    if (this.isWorkspaceMode()) {
      throw new Error('🚨 Workspace mode is currently not supported');
    }

    await this.translations.scan(true);

    // Validate schema consistency across locales
    await this.validateSchema();

    const result = this.translations.compile({
      force: true,
      diagnostics: true,
    });

    if (result.diagnostics.length > 0) {
      const errorMessages = result.diagnostics
        .map((diagnostic, i) => {
          const relativePath = diagnostic.path.replace(process.cwd(), '.');
          return `❌ Error ${i + 1}: ${diagnostic.name}
   📁 File: ${relativePath}
   💬 ${diagnostic.message}
   📝 ${diagnostic.description}`;
        })
        .join('\n\n');

      result.result.clear();

      throw new Error(
        `🚨 Compilation failed with ${result.diagnostics.length} error${result.diagnostics.length > 1 ? 's' : ''}:\n\n${errorMessages}`,
      );
    }

    return result.result;
  }

  /**
   * Validate that all locales match the primary locale schema.
   */
  private async validateSchema(): Promise<void> {
    const primaryLocale = this.config.primaryLocale;
    const primaryTranslations = this.translations.cache.get(primaryLocale);

    if (!primaryTranslations) {
      throw new Error(`🚨 Primary locale '${primaryLocale}' not found`);
    }

    const schemaErrors: string[] = [];

    // Get primary locale file structure
    const primaryFiles = new Set(primaryTranslations.keys());
    const primaryKeys = new Map<string, Set<string>>();

    for (const [fileName, translation] of primaryTranslations) {
      const keys = this.extractKeys(translation.data);
      primaryKeys.set(fileName, keys);
    }

    // Validate each locale against primary locale
    for (const [locale, translations] of this.translations.cache) {
      if (locale === primaryLocale) continue;

      const localeFiles = new Set(translations.keys());

      // Check for missing files
      for (const fileName of primaryFiles) {
        if (!localeFiles.has(fileName)) {
          schemaErrors.push(`❌ Missing file: ${locale}/${fileName}.toml (exists in ${primaryLocale})`);
        }
      }

      // Check for extra files
      for (const fileName of localeFiles) {
        if (!primaryFiles.has(fileName)) {
          schemaErrors.push(`❌ Extra file: ${locale}/${fileName}.toml (not in ${primaryLocale})`);
        }
      }

      // Check key structure for each file
      for (const [fileName, translation] of translations) {
        const primaryKeysForFile = primaryKeys.get(fileName);
        if (!primaryKeysForFile) continue;

        const localeKeys = this.extractKeys(translation.data);

        // Check for missing keys
        for (const key of primaryKeysForFile) {
          if (!localeKeys.has(key)) {
            schemaErrors.push(`❌ Missing key: ${locale}/${fileName}.toml → ${key}`);
          }
        }

        // Check for extra keys
        for (const key of localeKeys) {
          if (!primaryKeysForFile.has(key)) {
            schemaErrors.push(`❌ Extra key: ${locale}/${fileName}.toml → ${key}`);
          }
        }
      }
    }

    if (schemaErrors.length > 0) {
      const errorMessage = `🚨 Schema validation failed! All locales must match ${primaryLocale}:\n\n${schemaErrors.join('\n')}`;
      throw new Error(errorMessage);
    }
  }

  /**
   * Extract all keys from a translation data object recursively.
   */
  private extractKeys(data: any, prefix = ''): Set<string> {
    const keys = new Set<string>();

    for (const [key, value] of Object.entries(data)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursively extract nested keys
        const nestedKeys = this.extractKeys(value, fullKey);
        for (const nestedKey of nestedKeys) {
          keys.add(nestedKey);
        }
      } else {
        keys.add(fullKey);
      }
    }

    return keys;
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

    // Emit locale JSON files
    for (const [locale, translations] of resource.entries()) {
      const localeData: Record<string, any> = {};

      for (const translation of translations) {
        localeData[translation.metadata.name] = translation.content;
      }

      const localeFilePath = join(outputDir, `${locale}.json`);
      await writeFile(localeFilePath, JSON.stringify(localeData, null, 2));
    }

    // Emit TypeScript definitions using the configured generator
    await this.emitTypeScriptDefinitions(resource);
  }

  /**
   * Emit TypeScript definitions based on primary locale structure.
   * @param resource The compiled translations to emit.
   */
  private async emitTypeScriptDefinitions(resource: CompiledTranslations) {
    const generator = createDtsGenerator(this.config);

    if (!generator) {
      return; // DTS generation is disabled
    }

    const outputDir = this.getOutputDirectory();
    const primaryLocale = this.config.primaryLocale;

    try {
      const definitions = await generator.generate(resource, primaryLocale, outputDir, this.config, this);

      // Determine output path
      const outputPath = this.config.dtsOutput
        ? join(process.cwd(), this.config.dtsOutput)
        : join(outputDir, this.getDtsFileName());

      await writeFile(outputPath, definitions);
    } catch (error) {
      console.warn(`⚠️  Failed to generate TypeScript definitions: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Get the appropriate DTS file name based on the generator type.
   */
  private getDtsFileName(): string {
    switch (this.config.dts) {
      case 'i18next':
        return 'i18next.d.ts';
      case 'next-intl':
        return 'global.d.ts';
      default:
        return 'translations.d.ts';
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
