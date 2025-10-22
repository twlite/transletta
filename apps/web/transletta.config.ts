import { defineConfig } from 'transletta/config';

export default defineConfig({
  warnOnEmptyTranslations: false,
  dts: 'next-intl',
  dtsOutput: './global.d.ts',
});
