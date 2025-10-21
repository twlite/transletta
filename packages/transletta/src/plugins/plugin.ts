export interface TranslettaPlugin {
  /**
   * The name of the plugin.
   */
  name: string;
}

export function definePlugin(plugin: TranslettaPlugin): TranslettaPlugin {
  return plugin;
}
