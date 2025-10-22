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

    // Emit TypeScript definitions using primary locale
    await this.emitTypeScriptDefinitions(resource);
  }

  /**
   * Emit TypeScript definitions based on primary locale structure.
   * @param resource The compiled translations to emit.
   */
  private async emitTypeScriptDefinitions(resource: CompiledTranslations) {
    const outputDir = this.getOutputDirectory();
    const primaryLocale = this.config.primaryLocale;
    const primaryTranslations = resource.get(primaryLocale);

    if (!primaryTranslations) {
      console.warn(`⚠️  Primary locale '${primaryLocale}' not found, skipping TypeScript definitions`);
      return;
    }

    // Build the type structure from primary locale
    const typeStructure: Record<string, any> = {};

    for (const translation of primaryTranslations) {
      typeStructure[translation.metadata.name] = this.buildTypeFromContent(translation.content);
    }

    // Generate TypeScript definitions
    const typeDefinitions = this.generateTypeScriptDefinitions(typeStructure);
    const definitionsPath = join(outputDir, 'translations.d.ts');
    await writeFile(definitionsPath, typeDefinitions);
  }

  /**
   * Build TypeScript type structure from content.
   * @param content The translation content.
   * @returns TypeScript type structure.
   */
  private buildTypeFromContent(content: any): any {
    if (typeof content === 'string') {
      return 'string';
    }

    if (typeof content === 'object' && content !== null && !Array.isArray(content)) {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(content)) {
        result[key] = this.buildTypeFromContent(value);
      }
      return result;
    }

    return 'any';
  }

  /**
   * Generate TypeScript definitions string.
   * @param typeStructure The type structure.
   * @returns TypeScript definitions string.
   */
  private generateTypeScriptDefinitions(typeStructure: Record<string, any>): string {
    const primaryLocale = this.config.primaryLocale;

    let definitions = `// Auto-generated TypeScript definitions for translations\n`;
    definitions += `// Generated from primary locale: ${primaryLocale}\n\n`;

    definitions += `export interface Translations {\n`;

    for (const [category, structure] of Object.entries(typeStructure)) {
      // Quote category names that contain hyphens or other special characters
      const quotedCategory =
        category.includes('-') || category.includes('.') || category.includes(' ') ? `'${category}'` : category;
      definitions += `  ${quotedCategory}: ${this.typeToString(structure, 2)};\n`;
    }

    definitions += `}\n\n`;
    definitions += `declare const translations: Translations;\n`;
    definitions += `export default translations;\n`;

    return definitions;
  }

  /**
   * Convert type structure to TypeScript string.
   * @param type The type structure.
   * @param indent The indentation level.
   * @returns TypeScript type string.
   */
  private typeToString(type: any, indent: number = 0): string {
    const spaces = ' '.repeat(indent);

    if (type === 'string') {
      return 'string';
    }

    if (typeof type === 'object' && type !== null) {
      const lines = ['{'];
      for (const [key, value] of Object.entries(type)) {
        // Quote keys that contain hyphens or other special characters
        const quotedKey = key.includes('-') || key.includes('.') || key.includes(' ') ? `'${key}'` : key;
        lines.push(`${spaces}  ${quotedKey}: ${this.typeToString(value, indent + 2)};`);
      }
      lines.push(`${spaces}}`);
      return lines.join('\n');
    }

    return 'any';
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
