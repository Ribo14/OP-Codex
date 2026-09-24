import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { OfflineImagesSettings } from '@/catalog/OfflineImagesSettings'
import { ThemeSegmented } from './ThemeToggle'

// Impostazioni dell'app (RIB-37). Qui confluiranno anche installazione e account.

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border p-5">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  )
}

export function SettingsPage() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">{t('settings.title')}</h1>
      <SettingsSection title={t('settings.images.title')}>
        <OfflineImagesSettings />
      </SettingsSection>
      <SettingsSection title={t('theme.label')}>
        <div className="max-w-60">
          <ThemeSegmented />
        </div>
      </SettingsSection>
    </div>
  )
}
