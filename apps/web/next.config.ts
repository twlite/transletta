import type { NextConfig } from 'next';
import { createTransletta } from 'transletta/next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  transpilePackages: ['@transletta/ui'],
};

const withTransletta = createTransletta({
  compileOnBuild: true,
  watchInDevelopment: true,
});
const withNextIntl = createNextIntlPlugin();

export default withTransletta(withNextIntl(nextConfig));
