import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { Section } from './sections'

export function ComingSoonPage({ section }: { section: Section['key'] }) {
  const { t } = useTranslation()
  return (
    <section className="mx-auto max-w-xl py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t('comingSoon.title', { section: t(`nav.${section}`) })}
      </h1>
      <p className="mt-3 text-muted-foreground">{t('comingSoon.body')}</p>
    </section>
  )
}

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <section className="mx-auto max-w-xl py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{t('notFound.title')}</h1>
      <p className="mt-3 text-muted-foreground">{t('notFound.body')}</p>
      <Link
        to="/"
        className="mt-6 inline-block rounded-full bg-foreground px-4 py-2 text-sm text-background"
      >
        {t('notFound.back')}
      </Link>
    </section>
  )
}

export function PrivacyPage() {
  const { t } = useTranslation()
  const sections = [
    ['privacy.dataTitle', ['privacy.dataNow', 'privacy.dataLater']],
    ['privacy.deviceTitle', ['privacy.device']],
    ['privacy.providersTitle', ['privacy.providers']],
    ['privacy.rightsTitle', ['privacy.rights']],
    ['privacy.bandaiTitle', ['privacy.bandai']],
  ] as const

  return (
    <article className="mx-auto max-w-2xl space-y-6 leading-relaxed">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t('privacy.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('privacy.updated')}</p>
      </header>
      <p>{t('privacy.intro')}</p>
      {sections.map(([title, paragraphs]) => (
        <section key={title} className="space-y-2">
          <h2 className="text-lg font-semibold">{t(title)}</h2>
          {paragraphs.map((p) => (
            <p key={p} className="text-muted-foreground">
              {t(p)}
            </p>
          ))}
        </section>
      ))}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t('privacy.contactTitle')}</h2>
        <p className="text-muted-foreground">
          {t('privacy.contact')}{' '}
          <a
            href="https://github.com/Ribo14/OP-Codex/issues"
            className="text-foreground underline underline-offset-2"
            rel="noopener noreferrer"
            target="_blank"
          >
            {t('privacy.contactLink')}
          </a>
        </p>
      </section>
    </article>
  )
}
