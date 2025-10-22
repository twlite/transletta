import type { DtsGenerator } from '../generator.js';
import type { CompiledTranslations } from '../../managers/translation-manager.js';
import type { TranslettaConfig } from '../../../config/config.js';

export class DefaultDtsGenerator implements DtsGenerator {
  async generate(
    resource: CompiledTranslations,
    primaryLocale: string,
    outputDir: string,
    config: TranslettaConfig,
  ): Promise<string> {
    const primaryTranslations = resource.get(primaryLocale);

    if (!primaryTranslations) {
      throw new Error(`Primary locale '${primaryLocale}' not found`);
    }

    // Build the type structure from primary locale
    const typeStructure: Record<string, any> = {};

    for (const translation of primaryTranslations) {
      typeStructure[translation.metadata.name] = this.buildTypeFromContent(translation.content);
    }

    // Generate TypeScript definitions
    return this.generateTypeScriptDefinitions(typeStructure, primaryLocale);
  }

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

  private generateTypeScriptDefinitions(typeStructure: Record<string, any>, primaryLocale: string): string {
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
}
