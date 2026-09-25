-- Formato del Deck (RIB-23): Standard (Block Number System, predefinito) o Extra (nessun limite di
-- Block). Decide quali Deck Warning mostrare; non blocca mai il salvataggio.

alter table public.decks
  add column format text not null default 'standard'
    constraint decks_format check (format in ('standard', 'extra'));

comment on column public.decks.format is
  'Formato: standard (Block Number System) o extra (tutti i Block).';

grant update (format) on public.decks to authenticated;

-- La copia di un Deck mantiene anche il formato.
create or replace function public.duplica_mazzo(p_deck_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  nuovo uuid;
begin
  insert into public.decks (name, leader_code, leader_print_id)
  select left(d.name, 52) || ' (copia)', d.leader_code, d.leader_print_id
  from public.decks d
  where d.id = p_deck_id
  returning id into nuovo;

  if nuovo is null then
    raise exception 'mazzo_non_trovato' using errcode = 'P0002';
  end if;

  update public.decks
  set format = (select d.format from public.decks d where d.id = p_deck_id)
  where id = nuovo;

  insert into public.deck_cards (deck_id, card_code, quantity, print_id)
  select nuovo, c.card_code, c.quantity, c.print_id
  from public.deck_cards c
  where c.deck_id = p_deck_id;

  return nuovo;
end;
$$;
