import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// Solo valori pubblici: la sicurezza dei dati è affidata alla Row Level Security (ADR-0003).
const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

const client = url && publishableKey ? createClient<Database>(url, publishableKey) : null

export function getSupabase(): SupabaseClient<Database> {
  if (!client) {
    throw new Error(
      'Configurazione Supabase mancante: imposta VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY (vedi .env.example).',
    )
  }
  return client
}
