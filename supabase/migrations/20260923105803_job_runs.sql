-- Registro delle esecuzioni dei job (Catalog Sync, Image Sync).
-- Scrive solo il job (connessione diretta o service_role); la lettura per l'Admin arriverà in RIB-19.

create table public.job_runs (
  id          bigint generated always as identity primary key,
  job         text not null check (job in ('catalog_sync', 'image_sync')),
  status      text not null default 'running' check (status in ('running', 'success', 'error')),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  stats       jsonb not null default '{}'::jsonb,
  error       text,
  constraint job_runs_finished_when_done check ((status = 'running') = (finished_at is null))
);

comment on table public.job_runs is
  'Esecuzioni dei job: esito, conteggi (stats) ed eventuale errore.';

create index job_runs_job_started_idx on public.job_runs (job, started_at desc);

-- RLS attiva e nessuna policy: anon e authenticated non vedono né scrivono nulla.
alter table public.job_runs enable row level security;

revoke all on public.job_runs from anon, authenticated;
