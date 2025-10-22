import { getRequestConfig } from 'next-intl/server';
import { Locale } from 'next-intl';

export default getRequestConfig(async () => {
  const locale: Locale = 'en';

  return {
    locale,
    messages: (await import(`../../.transletta/generated/${locale}.json`)).default,
  };
});
