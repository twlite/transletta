import type { CompiledTranslations } from '../managers/translation-manager.js';
import type { TranslettaConfig } from '../../config/config.js';
import type { Transletta } from '../../transletta.js';

export interface DtsGenerator {
  generate(
    resource: CompiledTranslations,
    primaryLocale: string,
    outputDir: string,
    config: TranslettaConfig,
    transletta: Transletta,
  ): Promise<string>;
}

export interface DtsGeneratorOptions {
  outputDir: string;
  customOutputPath?: string;
}
