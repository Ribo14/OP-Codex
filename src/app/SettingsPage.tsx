import { ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useSession } from '@/account/session'
import { OfflineImagesSettings } from '@/catalog/OfflineImagesSettings'
import { ADMIN_PATH } from './sections'
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
      <AdminLink />
    </div>
  )
}

/**
 * Voce "Area Admin", solo per chi ha il ruolo nel token. È solo una scorciatoia: chi entra lo
 * decide il database (RIB-19).
 */
function AdminLink() {
  const { t } = useTranslation()
  const session = useSession()
  if (session.status !== 'signedIn' || session.user.app_metadata.admin !== true) return null
  return (
    <Link
      to={ADMIN_PATH}
      className="inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium hover:bg-muted"
    >
      <ShieldCheck className="size-4" aria-hidden="true" />
      {t('admin.title')}
    </Link>
  )
}
