export interface TranslettaConfig {
  /**
   * The Transletta plugins to use.
   */
  plugins: Array<never>;
  /**
   * The input directory for the translations.
   * @default '.transletta'
   */
  input: string;
  /**
   * The output directory for the compiled translations.
   * @default '.transletta/generated'
   */
  output: string;
  /**
   * The primary locale to use. All other locales will be derived from this one.
   * @default 'en'
   */
  primaryLocale: string;
  /**
   * The record of available projects to use (monorepos only).
   * @example
   * {
   *   'web': 'apps/web',
   *   'api': 'apps/api',
   * }
   * @default null
   */
  projects: Record<string, string> | null;
  /**
   * Whether to show a warning when empty translations are found.
   * @default true
   */
  warnOnEmptyTranslations: boolean;
}

export const DEFAULT_CONFIG: TranslettaConfig = {
  plugins: [],
  input: '.transletta',
  output: '.transletta/generated',
  primaryLocale: 'en',
  projects: null,
  warnOnEmptyTranslations: true,
};
