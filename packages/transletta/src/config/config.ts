import { DEFAULT_CONFIG, type PartialTranslettaConfig, type TranslettaConfig } from './common.js';

export type { TranslettaConfig };

/**
 * Define the Transletta configuration.
 * @param config The Transletta configuration.
 * @returns The Transletta configuration.
 */
export function defineConfig(config: PartialTranslettaConfig): TranslettaConfig {
  return Object.assign({}, DEFAULT_CONFIG, config);
}
