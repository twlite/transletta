import type { DtsGenerator } from '../core/dts/generator.js';

export interface TranslettaPlugin {
  /**
   * The name of the plugin.
   */
  name: string;
  /**
   * The dts generation configuration.
   */
  dts?: DtsGenerator & {
    /**
     * The list of supported dts generators.
     */
    generators: string[];
  };
}

export function definePlugin(plugin: TranslettaPlugin): TranslettaPlugin {
  return plugin;
}
