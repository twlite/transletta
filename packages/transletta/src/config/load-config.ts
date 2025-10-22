import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_CONFIG, type TranslettaConfig } from './common.js';
import { pathToFileURL } from 'node:url';

const CONFIG_FILE_NAMES = new Set([
  'transletta.config.js',
  'transletta.config.mjs',
  'transletta.config.cjs',
  'transletta.config.ts',
]);

/**
 * Load the Transletta configuration from the given path. If no config file is found, the default configuration is returned.
 * @param configPath The path to the Transletta configuration.
 * @returns The Transletta configuration.
 */
export async function loadConfig(configPath: string): Promise<TranslettaConfig> {
  const errors: Map<string, Error> = new Map();

  for (const configFile of CONFIG_FILE_NAMES) {
    try {
      const path = join(configPath, configFile);
      if (!existsSync(path)) continue;

      const config = await import(pathToFileURL(path).toString());
      return config.default as TranslettaConfig;
    } catch (error) {
      errors.set(configFile, error as Error);
    }
  }

  // could not find a config file
  if (!errors.size) {
    return DEFAULT_CONFIG;
  }

  // found some config files, but some failed to load
  const errorMessages = Array.from(errors.values())
    .map((error) => error?.stack || error?.message)
    .join('\n\n');

  throw new Error(`Failed to load config:\n${errorMessages}`, { cause: errors });
}
