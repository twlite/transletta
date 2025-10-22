'use client';

import { Button } from '@transletta/ui/components/button';
import { useTranslations } from 'next-intl';

export default function Page() {
  const t = useTranslations('home');

  return (
    <div className="flex items-center justify-center min-h-svh">
      <div className="flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Button size="sm">{t('login')}</Button>
      </div>
    </div>
  );
}
