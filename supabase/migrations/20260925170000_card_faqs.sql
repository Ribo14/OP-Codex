-- FAQ ufficiali delle carte (RIB-44): domande e risposte dei PDF di Bandai, in inglese, per Card Code.
-- Una riga per carta con l'elenco delle FAQ: così entrano nella copia del catalogo sul
-- dispositivo con lo stesso aggiornamento incrementale (su updated_at) di carte e Printing.
-- Una carta che perde tutte le FAQ resta con un elenco vuoto invece di sparire, perché
-- l'aggiornamento incrementale non vede le righe cancellate.
-- Le scrive solo il job (catalog-sync/sync-faqs.ts); lettura pubblica come il catalogo.

create table public.card_faqs (
  -- Nessuna chiave esterna verso cards: le FAQ possono arrivare prima del Catalog Sync della carta.
  card_code  text primary key
    constraint card_faqs_card_code check (card_code ~ '^[A-Z0-9]+-[0-9]+$'),
  -- [{ "question": "...", "answer": "...", "source": "qa_op05.pdf" }, ...] nell'ordine dei PDF.
  items      jsonb not null default '[]'::jsonb
    constraint card_faqs_items_array check (jsonb_typeof(items) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.card_faqs is
  'FAQ ufficiali di Bandai per Card Code (items: domanda, risposta, PDF di origine). Scritte dal job faq_sync.';

create index card_faqs_updated_at_idx on public.card_faqs (updated_at);

alter table public.card_faqs enable row level security;

create policy "FAQ leggibili da tutti" on public.card_faqs
  for select to anon, authenticated using (true);

-- Come per il catalogo: nessuna policy di scrittura e nessun permesso di scrittura ai ruoli pubblici.
revoke all on public.card_faqs from anon, authenticated;
grant select on public.card_faqs to anon, authenticated;

-- Il caricamento delle FAQ si registra in job_runs come gli altri job.
alter table public.job_runs drop constraint job_runs_job_check;
alter table public.job_runs
  add constraint job_runs_job_check check (job in ('catalog_sync', 'image_sync', 'faq_sync'));
