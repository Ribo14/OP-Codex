import { ADMIN_PATH } from '@/app/sections'

// Schede dell'area Admin (RIB-89): ognuna ha il suo indirizzo, così si torna dove si era.

export const ADMIN_TABS = [
  { key: 'overview', path: '' },
  { key: 'users', path: 'utenti' },
  { key: 'jobs', path: 'job' },
  { key: 'reports', path: 'segnalazioni' },
  { key: 'banList', path: 'ban-list' },
  { key: 'prices', path: 'prezzi' },
  { key: 'scanner', path: 'scanner' },
] as const

export type AdminTab = (typeof ADMIN_TABS)[number]['key']

export function adminPath(tab: AdminTab): string {
  const path = ADMIN_TABS.find((t) => t.key === tab)?.path ?? ''
  return path ? `${ADMIN_PATH}/${path}` : ADMIN_PATH
}

export function adminUserPath(id: string): string {
  return `${ADMIN_PATH}/utenti/${encodeURIComponent(id)}`
}

/** Elenco dei job filtrato su un job (dai riquadri della panoramica). */
export function adminJobPath(job: string): string {
  return `${adminPath('jobs')}?${new URLSearchParams({ job }).toString()}`
}
