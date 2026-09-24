import { Eye, EyeOff } from 'lucide-react'
import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

// Mattoncini dei moduli di account (RIB-14): etichette sempre visibili, errori annunciati.

const INPUT =
  'h-11 w-full rounded-xl border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-sm space-y-6 py-4">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children}
    </section>
  )
}

export function Field({
  label,
  hint,
  ...input
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={INPUT}
        {...input}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  )
}

export function PasswordField({
  label,
  hint,
  ...input
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const { t } = useTranslation()
  const id = useId()
  const [visible, setVisible] = useState(false)
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className={cn(INPUT, 'pr-12')}
          {...input}
        />
        <button
          type="button"
          onClick={() => {
            setVisible((v) => !v)
          }}
          aria-label={visible ? t('account.hidePassword') : t('account.showPassword')}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-xl text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  )
}

export function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      aria-busy={busy}
      className="h-11 w-full rounded-full bg-foreground text-sm font-medium text-background disabled:opacity-50"
    >
      {children}
    </button>
  )
}

/** Separatore tra "Continua con Google" e il modulo con email e password. */
export function OrDivider() {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
      <span className="h-px flex-1 bg-border" />
      {t('account.or')}
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

/** Messaggio sotto il modulo: errore (annunciato subito) o conferma. */
export function FormMessage({
  tone,
  children,
}: {
  tone: 'error' | 'success'
  children: ReactNode
}) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-xl px-3 py-2 text-sm',
        tone === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground',
      )}
    >
      {children}
    </p>
  )
}
