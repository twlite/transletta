import { DEFAULT_CONFIG, type TranslettaConfig } from './common';

export type { TranslettaConfig };

/**
 * Define the Transletta configuration.
 * @param config The Transletta configuration.
 * @returns The Transletta configuration.
 */
export function defineConfig(config: Partial<TranslettaConfig>): TranslettaConfig {
  return Object.assign({}, DEFAULT_CONFIG, config);
}
