import { useTranslation } from 'react-i18next'
import type { CodeProblem } from './errors'
import { Field, FormMessage } from './form'
import { CODE_LENGTH } from './mfa'

/** Messaggio per un codice rifiutato. */
export function CodeMessage({ problem }: { problem: CodeProblem }) {
  const { t } = useTranslation()
  return (
    <FormMessage tone="error">
      {problem === 'format' || problem === 'wrong'
        ? t(`account.code.problem.${problem}`, { length: CODE_LENGTH })
        : t(`account.problem.${problem}`)}
    </FormMessage>
  )
}

/** Campo per il codice di 6 cifre dell'app (RIB-18): tastierino numerico e completamento da SMS/app. */
export function CodeField({ name = 'code' }: { name?: string }) {
  const { t } = useTranslation()
  return (
    <Field
      label={t('account.code.label')}
      name={name}
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={CODE_LENGTH + 1}
      hint={t('account.code.hint', { length: CODE_LENGTH })}
      required
    />
  )
}
