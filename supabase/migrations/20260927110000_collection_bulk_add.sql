-- Aggiunta in blocco alla Collection (suggerimento dell'utente, 2026-09-27): tutte le carte di un
-- Set o di una lista in un'unica chiamata. Somma le copie a quelle già possedute, come i +.
-- security invoker: valgono le policy di collection_entries (solo la propria Collection, accesso
-- valido); user_id lo mette il default auth.uid(). Restituisce le copie aggiunte in tutto.
-- p_righe: [{"print_id": "ST01-001", "language": "EN", "quantity": 4}, ...]

create function public.aggiungi_copie(p_righe jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  aggiunte integer;
begin
  if p_righe is null or jsonb_typeof(p_righe) <> 'array' then
    raise exception 'righe_non_valide' using errcode = '22023';
  end if;
  if jsonb_array_length(p_righe) = 0 or jsonb_array_length(p_righe) > 1000 then
    raise exception 'troppe_righe' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_righe) as r(print_id text, language text, quantity integer)
    where r.print_id is null or r.language is null
      or r.quantity is null or r.quantity < 1 or r.quantity > 99
  ) then
    raise exception 'riga_non_valida' using errcode = '22023';
  end if;

  -- La stessa stampa e lingua ripetuta si somma prima (un upsert non tocca due volte la stessa riga).
  insert into public.collection_entries as e (print_id, language, quantity)
  select r.print_id, r.language, sum(r.quantity)
  from jsonb_to_recordset(p_righe) as r(print_id text, language text, quantity integer)
  group by r.print_id, r.language
  on conflict (user_id, print_id, language)
    do update set quantity = e.quantity + excluded.quantity;

  select sum(r.quantity)::integer into aggiunte
  from jsonb_to_recordset(p_righe) as r(print_id text, language text, quantity integer);
  return aggiunte;
end;
$$;

comment on function public.aggiungi_copie(jsonb) is
  'Aggiunge in blocco copie di più Printing alla propria Collection (al massimo 1000 righe, 99 copie per riga).';

revoke all on function public.aggiungi_copie(jsonb) from public, anon, authenticated;
grant execute on function public.aggiungi_copie(jsonb) to authenticated;

-- Composizione dei mazzi pronti (Starter Deck): quante copie di ogni carta ci sono dentro, così
-- "Da un set" propone le quantità giuste. Bandai non le pubblica: vengono dal file versionato
-- catalog-sync/decks/starter-decks.json (fonte indicata lì), caricato dal job recipe_sync come le
-- spiegazioni. Aggiungere un mazzo non richiede un deploy dell'app. Lettura pubblica.
create table public.set_recipes (
  set_code   text primary key
    constraint set_recipes_set_code check (set_code ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'),
  -- {"ST01-001": 1, "ST01-002": 4, ...}: Card Code → copie nel prodotto.
  cards      jsonb not null
    constraint set_recipes_cards check (jsonb_typeof(cards) = 'object'),
  source     text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.set_recipes is
  'Composizione dei mazzi pronti per Set (Card Code → copie), dal file del repo; job recipe_sync.';

alter table public.set_recipes enable row level security;

create policy "Composizioni leggibili da tutti" on public.set_recipes
  for select to anon, authenticated using (true);

revoke all on public.set_recipes from anon, authenticated;
grant select on public.set_recipes to anon, authenticated;

alter table public.job_runs drop constraint job_runs_job_check;
alter table public.job_runs
  add constraint job_runs_job_check
  check (job in (
    'catalog_sync', 'image_sync', 'faq_sync', 'explanation_sync', 'price_sync', 'cardtrader_sync',
    'recipe_sync'
  ));
