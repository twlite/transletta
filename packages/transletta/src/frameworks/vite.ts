import type { TranslettaConfig } from '../config/common.js';
import { Transletta } from '../transletta.js';
import { loadConfig } from '../config/load-config.js';
import { defineConfig } from '../config/config.js';

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

  const initTransletta = async () => {
    if (translettaInstance) return translettaInstance;
    const config = userConfig || (await loadConfig(process.cwd()).catch(() => null));
    if (!config) return null;
    translettaInstance = new Transletta(config);
    return translettaInstance;
  };

  return {
    name: 'transletta',

    async buildStart() {
      if (compileOnBuild) {
        await compileTranslationsInternal(userConfig);
      }
    },

    configureServer(server) {
      if (!watchInDevelopment) return;

      // Initialize and setup watcher
      initTransletta().then(async (instance) => {
        if (!instance) return;

        // Initial compilation
        await instance.compile().then(instance.emit.bind(instance));
        console.log('[Transletta] ✅ Successfully compiled translations');

        // Add input directory to Vite's watcher
        const inputDir = instance.getInputDirectory();
        server.watcher.add(inputDir);
      });
    },

    async handleHotUpdate(ctx) {
      if (!enableHMR) return;

      const { file, server } = ctx;

      // Check if the changed file is a translation file
      if (file.endsWith('.toml')) {
        if (isCompiling) return;
        isCompiling = true;

        try {
          const instance = await initTransletta();
          if (!instance) return;

          await instance.compile().then(instance.emit.bind(instance));

          if (hmrStrategy === 'full') {
            server.ws.send({ type: 'full-reload' });
          } else {
            const modulesToUpdate = await findTranslationDependentModules(server, file);

            if (modulesToUpdate.length > 0) {
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
              server.ws.send({ type: 'full-reload' });
            }
          }
        } catch (error) {
          console.error('[Transletta] ❌ Failed to recompile translations:', error);
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

    const config = await loadConfig(process.cwd()).catch(() => null);
    if (!config) return [];

    const transletta = new Transletta(config);
    const outputDir = transletta.getOutputDirectory();

    const { readdir } = await import('node:fs/promises');
    const { join } = await import('node:path');

    try {
      const files = await readdir(outputDir);
      const jsonFiles = files.filter((file) => file.endsWith('.json'));

      for (const jsonFile of jsonFiles) {
        const jsonPath = join(outputDir, jsonFile);
        const module = moduleGraph.getModuleById(jsonPath);

        if (module) {
          dependentModules.add((module as any).id);
          for (const importer of (module as any).importers) {
            dependentModules.add((importer as any).id);
          }
        }
      }
    } catch {
      // Ignore errors reading output directory
    }

    const allModules = Array.from(moduleGraph.idToModuleMap.values());
    for (const module of allModules) {
      if ((module as any).file && (module as any).file.includes('.transletta')) {
        dependentModules.add((module as any).id);
        for (const importer of (module as any).importers) {
          dependentModules.add((importer as any).id);
        }
      }
    }

    return Array.from(dependentModules);
  } catch {
    return [];
  }
}

/**
 * Compiles translations during build process.
 */
async function compileTranslationsInternal(userConfig?: TranslettaConfig) {
  try {
    const config =
      (userConfig ? defineConfig(userConfig) : null) || (await loadConfig(process.cwd()).catch(() => null));
    if (!config) return;

    const transletta = new Transletta(config);
    await transletta.compile().then(transletta.emit.bind(transletta));
    console.log('[Transletta] ✅ Successfully compiled translations');
  } catch (error) {
    console.error('[Transletta] ❌ Failed to compile translations:', error);
    throw error;
  }
}

/**
 * Utility function to manually compile translations.
 */
export async function compileTranslations(config?: TranslettaConfig): Promise<void> {
  try {
    const translettaConfig =
      (config ? defineConfig(config) : null) || (await loadConfig(process.cwd()).catch(() => null));
    if (!translettaConfig) {
      throw new Error(
        'No Transletta configuration found. Please provide a config or create a transletta.config.ts file.',
      );
    }
    const transletta = new Transletta(translettaConfig);
    await transletta.compile().then(transletta.emit.bind(transletta));
    console.log('[Transletta] ✅ Successfully compiled translations');
  } catch (error) {
    console.error('[Transletta] ❌ Failed to compile translations:', error);
    throw error;
  }
}
