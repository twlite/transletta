import type { TranslettaConfig } from '../config/common.js';
import { Transletta } from '../transletta.js';
import { loadConfig } from '../config/load-config.js';

// @ts-ignore
type NextConfig = import('next').NextConfig;

export interface TranslettaNextConfig {
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
}

let phases: string[] = [],
  devPhase: string = 'phase-development-server';

async function getPhases() {
  if (phases.length > 0) return phases;

  const {
    PHASE_DEVELOPMENT_SERVER,
    PHASE_PRODUCTION_BUILD,
    // @ts-ignore
  } = await import('next/constants').catch(() => {
    // in case import fails for some reason, use fallback values
    // taken from https://github.com/vercel/next.js/blob/5e6b008b561caf2710ab7be63320a3d549474a5b/packages/next/shared/lib/constants.ts#L19-L22
    return {
      PHASE_DEVELOPMENT_SERVER: 'phase-development-server',
      PHASE_PRODUCTION_BUILD: 'phase-production-build',
    };
  });

  devPhase = PHASE_DEVELOPMENT_SERVER;

  return (phases = [PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD]);
}

/**
 * Creates a Next.js plugin that integrates Transletta with the build process.
 *
 * @param options Configuration options for the Transletta Next.js integration
 * @returns A Next.js configuration wrapper function
 *
 * @example
 * ```ts
 * import { createTransletta } from 'transletta/next'
 *
 * const nextConfig = {
 *   // your Next.js config
 * }
 *
 * const withTransletta = createTransletta({
 *   compileOnBuild: true,
 *   watchInDevelopment: true
 * })
 *
 * export default withTransletta(nextConfig)
 * ```
 */
export function createTransletta(options: TranslettaNextConfig = {}) {
  const { config: userConfig, compileOnBuild = true, watchInDevelopment = true } = options;

  let isInitialized = false;

  const initializeTransletta = (isDev: boolean) => {
    if (isInitialized) return;
    isInitialized = true;

    if (isDev && watchInDevelopment) {
      setupDevelopmentWatcher(userConfig);
    } else if (!isDev && compileOnBuild) {
      compileTranslationsInternal(userConfig);
    }
  };

  return function withTransletta(nextConfig: NextConfig = {}): NextConfig {
    return async (phase: any) => {
      const phases = await getPhases();

      if (phases.includes(phase)) {
        initializeTransletta(phase === devPhase);
      }

      return typeof nextConfig === 'function' ? nextConfig(...arguments) : nextConfig;
    };
  };
}

/**
 * Sets up file watching for translation files in development mode.
 */
async function setupDevelopmentWatcher(userConfig?: TranslettaConfig) {
  try {
    const config = userConfig || (await loadConfig(process.cwd()).catch(() => null));
    if (!config) {
      console.warn('⚠️ No Transletta configuration found. Skipping development watcher setup.');
      return;
    }

    const transletta = new Transletta(config);
    await transletta.compile().then(transletta.emit.bind(transletta));

    const { watch } = await import('node:fs');
    const translationDir = transletta.getInputDirectory();

    console.log(`👀 [Transletta] (${process.pid}) Watching translation files in: ${translationDir}`);

    let compileTimeout: NodeJS.Timeout | null = null;
    const pendingFiles = new Set<string>();

    watch(translationDir, { recursive: true }, async (eventType, filename) => {
      if (filename && filename.endsWith('.toml')) {
        pendingFiles.add(filename);

        // Clear existing timeout
        if (compileTimeout) {
          clearTimeout(compileTimeout);
        }

        // Debounce compilation by 300ms
        compileTimeout = setTimeout(async () => {
          if (pendingFiles.size > 0) {
            pendingFiles.clear();

            try {
              await transletta.compile().then(transletta.emit.bind(transletta));
            } catch (error) {
              console.error('❌ Failed to recompile translations:', error);
            }
          }
        }, 300);
      }
    });
  } catch (error) {
    console.error('❌ Failed to setup Transletta development watcher:', error);
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

    await transletta.compile().then(transletta.emit.bind(transletta));
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
 * import { compileTranslations } from 'transletta/next'
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
