-- Collection (RIB-20): quante copie di ogni Printing possiede un User, per lingua di stampa.
-- Segue la regola delle tabelle personali (ADR-0013): cascade da auth.users e policy restrictive.

create table public.collection_entries (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  print_id   text not null references public.printings (print_id),
  -- Lingua di stampa: si aggiunge una lingua cambiando solo questo elenco.
  language   text not null default 'EN'
    constraint collection_entries_language check (language in ('EN', 'JP', 'FR', 'CN', 'KR')),
  quantity   integer not null
    constraint collection_entries_quantity check (quantity between 1 and 9999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, print_id, language)
);

comment on table public.collection_entries is
  'Collection Entry: copie di una Printing possedute da un User, per lingua di stampa.';

-- Stessa funzione dei profili: aggiorna updated_at (serve all'ordinamento "aggiunte di recente").
create trigger collection_entries_touch_updated_at
  before update on public.collection_entries
  for each row execute function public.profiles_touch_updated_at();

alter table public.collection_entries enable row level security;

create policy "Solo con un accesso valido" on public.collection_entries
  as restrictive
  for all to authenticated
  using ((select private.accesso_valido()))
  with check ((select private.accesso_valido()));

-- La visibilità agli amici arriverà nella fase 6.
create policy "La propria Collection è leggibile" on public.collection_entries
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Si aggiunge solo alla propria Collection" on public.collection_entries
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Si modifica solo la propria Collection" on public.collection_entries
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Si toglie solo dalla propria Collection" on public.collection_entries
  for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.collection_entries from anon, authenticated;
grant select, delete on public.collection_entries to authenticated;
grant insert (print_id, language, quantity) on public.collection_entries to authenticated;
grant update (quantity) on public.collection_entries to authenticated;

-- +/− dal dettaglio Card: somma `delta` alle copie in un'unica istruzione, così tocchi veloci o
-- due dispositivi insieme non si sovrascrivono. Arrivati a 0 la Collection Entry sparisce.
-- security invoker: valgono le policy qui sopra. Restituisce le copie dopo il cambio.
create function public.cambia_copie(p_print_id text, p_language text, p_delta integer)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  copie integer;
begin
  if p_delta is null or p_delta = 0 or abs(p_delta) > 99 then
    raise exception 'delta_non_valido' using errcode = '22023';
  end if;

  if p_delta > 0 then
    insert into public.collection_entries as e (print_id, language, quantity)
    values (p_print_id, p_language, p_delta)
    on conflict (user_id, print_id, language)
      do update set quantity = e.quantity + excluded.quantity
    returning quantity into copie;
    return copie;
  end if;

  -- Resta almeno una copia: si toglie e basta.
  update public.collection_entries
  set quantity = quantity + p_delta
  where user_id = auth.uid()
    and print_id = p_print_id
    and language = p_language
    and quantity + p_delta >= 1
  returning quantity into copie;
  if found then
    return copie;
  end if;

  -- Si arriva a 0 (o la Entry non c'era): la Collection Entry sparisce.
  delete from public.collection_entries
  where user_id = auth.uid() and print_id = p_print_id and language = p_language;
  return 0;
end;
$$;

comment on function public.cambia_copie(text, text, integer) is
  'Aggiunge o toglie copie di una Printing nella propria Collection; a 0 la Entry sparisce.';

revoke all on function public.cambia_copie(text, text, integer) from public, anon, authenticated;
grant execute on function public.cambia_copie(text, text, integer) to authenticated;
