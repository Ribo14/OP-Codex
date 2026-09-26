-- Card Explanation (RIB-52, ADR-0006): la spiegazione in italiano di una carta, scritta in anticipo
-- nelle sessioni di sviluppo e versionata nel repo (catalog-sync/explanations/*.json). L'app non
-- chiama mai un modello: legge questa tabella, come il catalogo, anche offline.
-- Una carta la cui spiegazione viene tolta dai file resta con il testo vuoto invece di sparire,
-- perché l'aggiornamento incrementale della copia sul dispositivo non vede le righe cancellate.
-- La scrive solo il job (catalog-sync/sync-explanations.ts); lettura pubblica.

create table public.card_explanations (
  -- Nessuna chiave esterna verso cards: come le FAQ, può arrivare prima del Catalog Sync.
  card_code  text primary key
    constraint card_explanations_card_code check (card_code ~ '^[A-Z0-9]+-[0-9]+$'),
  -- Markdown semplice (paragrafi, elenchi, grassetto); vuoto = nessuna spiegazione.
  body       text not null default ''
    constraint card_explanations_body_length check (char_length(body) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.card_explanations is
  'Card Explanation in italiano per Card Code (ADR-0006). Scritte dal job explanation_sync dai file del repo.';

create index card_explanations_updated_at_idx on public.card_explanations (updated_at);

alter table public.card_explanations enable row level security;

create policy "Spiegazioni leggibili da tutti" on public.card_explanations
  for select to anon, authenticated using (true);

-- Come per il catalogo: nessuna policy di scrittura e nessun permesso di scrittura ai ruoli pubblici.
revoke all on public.card_explanations from anon, authenticated;
grant select on public.card_explanations to anon, authenticated;

alter table public.job_runs drop constraint job_runs_job_check;
alter table public.job_runs
  add constraint job_runs_job_check
  check (job in ('catalog_sync', 'image_sync', 'faq_sync', 'explanation_sync'));
