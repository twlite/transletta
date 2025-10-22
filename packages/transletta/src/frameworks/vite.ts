import type { TranslettaConfig } from '../config/common.js';
import { Transletta } from '../transletta.js';
import { loadConfig } from '../config/load-config.js';

type VitePlugin = {
  name: string;
  buildStart?: () => void | Promise<void>;
  buildEnd?: () => void | Promise<void>;
  handleHotUpdate?: (ctx: any) => void | Promise<void>;
  configureServer?: (server: any) => void;
  [key: string]: any;
};

export interface TranslettaViteConfig {
  /**
   * The Transletta configuration to use.
   * If not provided, will attempt to load from transletta.config.ts
   */
  config?: TranslettaConfig;

  /**
   * Whether to run Transletta compilation during build.
   * @default true
   */
  compileOnBuild?: boolean;

  /**
   * Whether to watch for translation file changes in development.
   * @default true
   */
  watchInDevelopment?: boolean;

  /**
   * Whether to enable HMR (Hot Module Replacement) for translation files.
   * @default true
   */
  enableHMR?: boolean;

  /**
   * HMR strategy: 'targeted' for partial updates, 'full' for full page reload.
   * @default 'targeted'
   */
  hmrStrategy?: 'targeted' | 'full';
}

/**
 * Creates a Vite plugin that integrates Transletta with the build process.
 *
 * @param options Configuration options for the Transletta Vite integration
 * @returns A Vite plugin object
 *
 * @example
 * ```ts
 * import { transletta } from 'transletta/vite'
 * import { defineConfig } from 'vite'
 *
 * export default defineConfig({
 *   plugins: [
 *     transletta({
 *       compileOnBuild: true,
 *       watchInDevelopment: true,
 *       enableHMR: true,
 *       hmrStrategy: 'targeted', // or 'full' for full page reloads
 *     })
 *   ]
 * })
 * ```
 */
export function transletta(options: TranslettaViteConfig = {}): VitePlugin {
  const {
    config: userConfig,
    compileOnBuild = true,
    watchInDevelopment = true,
    enableHMR = true,
    hmrStrategy = 'targeted',
  } = options;

  let translettaInstance: Transletta | null = null;
  let isCompiling = false;

  return {
    name: 'transletta',

    async buildStart() {
      if (compileOnBuild) {
        await compileTranslationsInternal(userConfig);
      }
    },

    async buildEnd() {
      if (compileOnBuild && translettaInstance) {
        console.log('✅ Transletta build completed');
      }
    },

    configureServer(server) {
      if (watchInDevelopment) {
        setupDevelopmentWatcher(userConfig, server, hmrStrategy);
      }
    },

    async handleHotUpdate(ctx) {
      if (!enableHMR) return;

      const { file, server } = ctx;

      // Check if the changed file is a translation file
      if (file.endsWith('.toml')) {
        console.log(`🔄 Translation file changed: ${file}`);

        if (isCompiling) return; // Prevent concurrent compilations

        isCompiling = true;
        try {
          // Initialize transletta instance if not already done
          if (!translettaInstance) {
            const config = userConfig || (await loadConfig(process.cwd()).catch(() => null));
            if (!config) {
              console.warn('⚠️ No Transletta configuration found. Skipping HMR.');
              return;
            }
            translettaInstance = new Transletta(config);
          }

          await translettaInstance.compile().then(translettaInstance.emit.bind(translettaInstance));
          console.log('✅ Translations recompiled successfully');

          // Choose HMR strategy
          if (hmrStrategy === 'full') {
            console.log('🔄 Performing full reload (strategy: full)');
            server.ws.send({
              type: 'full-reload',
            });
          } else {
            // Find modules that depend on translation files and invalidate them
            const modulesToUpdate = await findTranslationDependentModules(server, file);

            if (modulesToUpdate.length > 0) {
              console.log(`🔄 Updating ${modulesToUpdate.length} dependent module(s) (strategy: targeted)`);

              // Send targeted HMR updates for each dependent module
              for (const moduleId of modulesToUpdate) {
                server.ws.send({
                  type: 'update',
                  updates: [
                    {
                      type: 'js-update',
                      path: moduleId,
                      acceptedPath: moduleId,
                      timestamp: Date.now(),
                    },
                  ],
                });
              }
            } else {
              // Fallback to full reload if no specific modules found
              console.log('⚠️ No dependent modules found, performing full reload');
              server.ws.send({
                type: 'full-reload',
              });
            }
          }
        } catch (error) {
          console.error('❌ Failed to recompile translations:', error);
        } finally {
          isCompiling = false;
        }
      }
    },
  };
}

/**
 * Finds modules that depend on translation files by analyzing the module graph.
 */
async function findTranslationDependentModules(server: any, changedFile: string): Promise<string[]> {
  try {
    const moduleGraph = server.moduleGraph;
    const dependentModules = new Set<string>();

    // Get the output directory to find generated JSON files
    const config = await loadConfig(process.cwd()).catch(() => null);
    if (!config) return [];

    const transletta = new Transletta(config);
    const outputDir = transletta.getOutputDirectory();

    // Find all generated JSON files that might be affected
    const { readdir } = await import('node:fs/promises');
    const { join } = await import('node:path');

    try {
      const files = await readdir(outputDir);
      const jsonFiles = files.filter((file) => file.endsWith('.json'));

      for (const jsonFile of jsonFiles) {
        const jsonPath = join(outputDir, jsonFile);

        // Find modules that import this JSON file
        const module = moduleGraph.getModuleById(jsonPath);
        if (module) {
          // Add the module itself
          dependentModules.add((module as any).id);

          // Add all modules that import this module
          for (const importer of (module as any).importers) {
            dependentModules.add((importer as any).id);
          }
        }
      }
    } catch (error) {
      // Output directory might not exist yet
      console.warn('⚠️ Could not read output directory:', error);
    }

    // Also look for modules that might import translation files directly
    // This covers cases where apps import .toml files or use custom loaders
    const allModules = Array.from(moduleGraph.idToModuleMap.values());

    for (const module of allModules) {
      if ((module as any).file && (module as any).file.includes('.transletta')) {
        dependentModules.add((module as any).id);

        // Add all modules that import this module
        for (const importer of (module as any).importers) {
          dependentModules.add((importer as any).id);
        }
      }
    }

    return Array.from(dependentModules);
  } catch (error) {
    console.warn('⚠️ Error finding dependent modules:', error);
    return [];
  }
}

/**
 * Sets up file watching for translation files in development mode.
 */
async function setupDevelopmentWatcher(
  userConfig?: TranslettaConfig,
  server?: any,
  hmrStrategy: 'targeted' | 'full' = 'targeted',
) {
  try {
    const config = userConfig || (await loadConfig(process.cwd()).catch(() => null));
    if (!config) {
      console.warn('⚠️ No Transletta configuration found. Skipping development watcher setup.');
      return;
    }

    const transletta = new Transletta(config);

    // Initial compilation
    await transletta.compile().then(transletta.emit.bind(transletta));

    // Set up file watching for development
    const { watch } = await import('node:fs');
    const translationDir = transletta.getInputDirectory();

    watch(translationDir, { recursive: true }, async (eventType, filename) => {
      if (filename && filename.endsWith('.toml')) {
        console.log(`🔄 Translation file changed: ${filename}`);
        try {
          await transletta.compile().then(transletta.emit.bind(transletta));
          console.log('✅ Translations recompiled successfully');

          // Notify Vite dev server about the change
          if (server) {
            if (hmrStrategy === 'full') {
              console.log('🔄 Performing full reload (strategy: full)');
              server.ws.send({
                type: 'full-reload',
              });
            } else {
              const modulesToUpdate = await findTranslationDependentModules(server, filename);

              if (modulesToUpdate.length > 0) {
                console.log(`🔄 Updating ${modulesToUpdate.length} dependent module(s) (strategy: targeted)`);

                // Send targeted HMR updates for each dependent module
                for (const moduleId of modulesToUpdate) {
                  server.ws.send({
                    type: 'update',
                    updates: [
                      {
                        type: 'js-update',
                        path: moduleId,
                        acceptedPath: moduleId,
                        timestamp: Date.now(),
                      },
                    ],
                  });
                }
              } else {
                // Fallback to full reload if no specific modules found
                console.log('⚠️ No dependent modules found, performing full reload');
                server.ws.send({
                  type: 'full-reload',
                });
              }
            }
          }
        } catch (error) {
          console.error('❌ Failed to recompile translations:', error);
        }
      }
    });

    console.log('👀 Watching translation files for changes...');
  } catch (error) {
    console.warn('⚠️ Failed to setup Transletta development watcher:', error);
  }
}

/**
 * Compiles translations during build process.
 */
async function compileTranslationsInternal(userConfig?: TranslettaConfig) {
  try {
    const config = userConfig || (await loadConfig(process.cwd()).catch(() => null));
    if (!config) {
      console.warn('⚠️ No Transletta configuration found. Skipping compilation.');
      return;
    }
    const transletta = new Transletta(config);

    console.log('🔨 Compiling translations...');
    await transletta.compile().then(transletta.emit.bind(transletta));
    console.log('✅ Translations compiled successfully');
  } catch (error) {
    console.error('❌ Failed to compile translations:', error);
    throw error; // Fail the build if translations fail
  }
}

/**
 * Utility function to manually compile translations.
 * Useful for custom build scripts or CI/CD pipelines.
 *
 * @param config Optional Transletta configuration
 * @returns Promise that resolves when compilation is complete
 *
 * @example
 * ```ts
 * import { compileTranslations } from 'transletta/vite'
 *
 * // Compile with default config
 * await compileTranslations()
 *
 * // Compile with custom config
 * await compileTranslations({
 *   input: './locales',
 *   output: './public/locales',
 *   primaryLocale: 'en'
 * })
 * ```
 */
export async function compileTranslations(config?: TranslettaConfig): Promise<void> {
  try {
    const translettaConfig = config || (await loadConfig(process.cwd()).catch(() => null));
    if (!translettaConfig) {
      throw new Error(
        'No Transletta configuration found. Please provide a config or create a transletta.config.ts file.',
      );
    }
    const transletta = new Transletta(translettaConfig);

    console.log('🔨 Compiling translations...');
    await transletta.compile().then(transletta.emit.bind(transletta));
    console.log('✅ Translations compiled successfully');
  } catch (error) {
    console.error('❌ Failed to compile translations:', error);
    throw error;
  }
}
