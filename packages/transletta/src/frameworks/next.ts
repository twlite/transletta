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

  // Initialize immediately for both webpack and Turbopack
  const initializeTransletta = () => {
    if (isInitialized) return;
    isInitialized = true;

    if (watchInDevelopment) {
      console.log('🔨 Initializing Transletta for development...');
      setupDevelopmentWatcher(userConfig);
    } else if (compileOnBuild) {
      console.log('🔨 Compiling Transletta for production...');
      compileTranslationsInternal(userConfig);
    }
  };

  // Initialize immediately (works for both webpack and Turbopack)
  initializeTransletta();

  return function withTransletta(nextConfig: NextConfig = {}): NextConfig {
    return {
      ...nextConfig,

      webpack(config: any, { dev, isServer }: { dev: boolean; isServer: boolean }) {
        // Run the original webpack config first
        if (nextConfig.webpack) {
          config = nextConfig.webpack(config, { dev, isServer });
        }

        // Transletta is already initialized, just return the config
        return config;
      },

      // Turbopack-specific initialization
      experimental: {
        ...nextConfig.experimental,
        turbo: {
          ...nextConfig.experimental?.turbo,
          rules: {
            ...nextConfig.experimental?.turbo?.rules,
            // Add any Turbopack-specific rules if needed
          },
        },
      },

      // Alternative initialization for Turbopack
      async rewrites() {
        const rewrites = nextConfig.rewrites ? await nextConfig.rewrites() : [];

        // Transletta is already initialized, just return rewrites
        return rewrites;
      },
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

    console.log('📁 Loading Transletta configuration...');
    const transletta = new Transletta(config);

    // Initial compilation
    console.log('🔨 Compiling translations...');
    await transletta.compile().then(transletta.emit.bind(transletta));
    console.log('✅ Initial translation compilation completed');

    // Set up file watching for development with debouncing
    const { watch } = await import('node:fs');
    const translationDir = transletta.getInputDirectory();

    console.log(`👀 Watching translation files in: ${translationDir}`);

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
            const files = Array.from(pendingFiles);
            console.log(`🔄 Translation files changed: ${files.join(', ')}`);
            pendingFiles.clear();

            try {
              await transletta.compile().then(transletta.emit.bind(transletta));
              console.log('✅ Translations recompiled successfully');
            } catch (error) {
              console.error('❌ Failed to recompile translations:', error);
            }
          }
        }, 300);
      }
    });

    console.log('👀 Watching translation files for changes...');
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
