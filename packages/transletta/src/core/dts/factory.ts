import type { DtsGenerator } from './generator.js';
import type { TranslettaConfig } from '../../config/common.js';
import { DefaultDtsGenerator } from './generators/default.js';
import { I18nextDtsGenerator } from './generators/i18next.js';
import { NextIntlDtsGenerator } from './generators/next-intl.js';

export function createDtsGenerator(config: TranslettaConfig): DtsGenerator | null {
  if (config.dts === false) {
    return null;
  }

  if (typeof config.dts === 'string') {
    const plugins = config.plugins?.find((p) => p.dts?.generators?.includes(config.dts as string));

    if (plugins?.dts) {
      return plugins.dts;
    }
  }

  switch (config.dts) {
    case true:
      return new DefaultDtsGenerator();
    case 'i18next':
      return new I18nextDtsGenerator();
    case 'next-intl':
      return new NextIntlDtsGenerator();
    default:
      return new DefaultDtsGenerator();
  }
}
