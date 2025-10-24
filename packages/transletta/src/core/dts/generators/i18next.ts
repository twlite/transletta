import type { DtsGenerator } from '../generator.js';
import type { CompiledTranslations } from '../../managers/translation-manager.js';
import type { TranslettaConfig } from '../../../config/config.js';
import { join, relative } from 'node:path';
import { generateRelativePath } from './common.js';

export class I18nextDtsGenerator implements DtsGenerator {
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

    // Compute the correct relative path to the JSON file
    const jsonFileName = `${primaryLocale}.json`;
    const jsonFilePath = join(outputDir, jsonFileName);

    // Determine where the DTS file will be written
    const dtsOutputPath = config.dtsOutput ? join(process.cwd(), config.dtsOutput) : join(outputDir, 'i18next.d.ts');

    // Calculate relative path from DTS file to JSON file
    const localeFile = generateRelativePath(jsonFilePath, dtsOutputPath);

    let definitions = `/* eslint-disable */\n`;
    definitions += `// Auto-generated i18next TypeScript definitions\n`;
    definitions += `// Generated from primary locale: ${primaryLocale}\n\n`;

    definitions += `// import the original type declarations\n`;
    definitions += `import "i18next";\n`;
    definitions += `// import the main locale file\n`;
    definitions += `import messages from "${localeFile}";\n\n`;

    definitions += `declare module "i18next" {\n`;
    definitions += `  // Extend CustomTypeOptions\n`;
    definitions += `  interface CustomTypeOptions {\n`;
    definitions += `    // custom namespace type, if you changed it\n`;
    definitions += `    defaultNS: "common";\n`;
    definitions += `    // custom resources type\n`;
    definitions += `    resources: {\n`;
    definitions += `      common: typeof messages;\n`;
    definitions += `    };\n`;
    definitions += `    // other\n`;
    definitions += `  }\n`;
    definitions += `}\n`;

    return definitions;
  }
}
