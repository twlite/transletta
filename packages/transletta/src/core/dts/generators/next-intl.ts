import type { DtsGenerator } from '../generator.js';
import type { CompiledTranslations } from '../../managers/translation-manager.js';
import type { TranslettaConfig } from '../../../config/config.js';
import { join } from 'node:path';
import { generateRelativePath } from './common.js';
import type { Transletta } from '../../../transletta.js';

export class NextIntlDtsGenerator implements DtsGenerator {
  async generate(
    resource: CompiledTranslations,
    primaryLocale: string,
    outputDir: string,
    config: TranslettaConfig,
    transletta: Transletta,
  ): Promise<string> {
    const primaryTranslations = resource.get(primaryLocale);

    if (!primaryTranslations) {
      throw new Error(`Primary locale '${primaryLocale}' not found`);
    }

    // Compute the correct relative path to the JSON file
    const jsonFileName = `${primaryLocale}.json`;
    const jsonFilePath = join(outputDir, jsonFileName);

    // Determine where the DTS file will be written
    const dtsOutputPath = config.dtsOutput ? join(process.cwd(), config.dtsOutput) : join(outputDir, 'global.d.ts');

    // Calculate relative path from DTS file to JSON file
    const localeFile = generateRelativePath(jsonFilePath, dtsOutputPath);

    const availableLocales = transletta.translations.cache.toKeyArray();

    let definitions = `// Auto-generated next-intl TypeScript definitions\n`;
    definitions += `// Generated from primary locale: ${primaryLocale}\n\n`;

    definitions += `import {routing} from '@/i18n/routing';\n`;
    definitions += `import {formats} from '@/i18n/request';\n`;
    definitions += `import messages from "${localeFile}";\n\n`;

    definitions += `declare module 'next-intl' {\n`;
    definitions += `  interface AppConfig {\n`;
    definitions += `    Locale: ${availableLocales.map((locale) => `'${locale}'`).join(' | ')};\n`;
    definitions += `    Messages: typeof messages;\n`;
    definitions += `    Formats: typeof formats;\n`;
    definitions += `  }\n`;
    definitions += `}\n`;

    return definitions;
  }
}
