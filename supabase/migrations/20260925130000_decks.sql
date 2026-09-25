-- Deck builder (RIB-21): Deck di un User con Leader e carte contate per Card Code.
-- Segue la regola delle tabelle personali (ADR-0013): cascade da auth.users e policy restrictive.

create table public.decks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name            text not null
    constraint decks_name_length check (char_length(btrim(name)) between 1 and 60),
  leader_code     text not null references public.cards (card_code),
  -- Printing del Leader da mostrare; null = la base.
  leader_print_id text references public.printings (print_id),
  -- Share Link e amici arriveranno con RIB-26.
  visibility      text not null default 'private'
    constraint decks_visibility check (visibility in ('private')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint decks_leader_print_matches check (
    leader_print_id is null or leader_print_id = leader_code or leader_print_id like leader_code || '\_%'
  )
);

comment on table public.decks is 'Deck di un User: Leader più carte (deck_cards), anche incompleto.';

create index decks_user_idx on public.decks (user_id, updated_at desc);

create table public.deck_cards (
  deck_id   uuid not null references public.decks (id) on delete cascade,
  card_code text not null references public.cards (card_code),
  quantity  integer not null
    constraint deck_cards_quantity check (quantity between 1 and 50),
  -- Printing da mostrare; null = la base. Non cambia il conteggio, che è per Card Code.
  print_id  text references public.printings (print_id),
  primary key (deck_id, card_code),
  constraint deck_cards_print_matches check (
    print_id is null or print_id = card_code or print_id like card_code || '\_%'
  )
);

comment on table public.deck_cards is 'Carte di un Deck, contate per Card Code, con la Printing mostrata.';

-- Il Leader dev'essere una Card di categoria Leader.
create function private.decks_controlla_leader()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.cards c where c.card_code = new.leader_code and c.category = 'Leader'
  ) then
    raise exception 'leader_non_valido' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger decks_controlla_leader
  before insert or update of leader_code on public.decks
  for each row execute function private.decks_controlla_leader();

create trigger decks_touch_updated_at
  before update on public.decks
  for each row execute function public.profiles_touch_updated_at();

-- Cambiare le carte aggiorna la data del Deck (ordina l'elenco dei Mazzi). security definer:
-- l'utente non ha il permesso di scrivere updated_at, e il trigger tocca solo il Deck della riga.
create function private.deck_cards_tocca_mazzo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.decks set updated_at = now() where id = coalesce(new.deck_id, old.deck_id);
  return null;
end;
$$;

create trigger deck_cards_tocca_mazzo
  after insert or update or delete on public.deck_cards
  for each row execute function private.deck_cards_tocca_mazzo();

-- Row Level Security: ognuno legge e scrive solo i propri Deck.
alter table public.decks enable row level security;
alter table public.deck_cards enable row level security;

create policy "Solo con un accesso valido" on public.decks
  as restrictive for all to authenticated
  using ((select private.accesso_valido()))
  with check ((select private.accesso_valido()));

create policy "Solo con un accesso valido" on public.deck_cards
  as restrictive for all to authenticated
  using ((select private.accesso_valido()))
  with check ((select private.accesso_valido()));

create policy "I propri Deck" on public.decks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Le carte dei propri Deck" on public.deck_cards
  for all to authenticated
  using (
    exists (select 1 from public.decks d where d.id = deck_id and d.user_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.decks d where d.id = deck_id and d.user_id = (select auth.uid()))
  );

revoke all on public.decks from anon, authenticated;
revoke all on public.deck_cards from anon, authenticated;
grant select, delete on public.decks to authenticated;
grant insert (name, leader_code, leader_print_id) on public.decks to authenticated;
grant update (name, leader_code, leader_print_id) on public.decks to authenticated;
grant select, delete on public.deck_cards to authenticated;
grant insert (deck_id, card_code, quantity, print_id) on public.deck_cards to authenticated;
grant update (quantity, print_id) on public.deck_cards to authenticated;

-- +/− di una carta nel Deck: somma atomica come per la Collection; a 0 la riga sparisce.
-- security invoker: le policy decidono se il Deck è di chi chiama. Restituisce le copie.
create function public.cambia_carte_mazzo(p_deck_id uuid, p_card_code text, p_delta integer)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  copie integer;
begin
  if p_delta is null or p_delta = 0 or abs(p_delta) > 50 then
    raise exception 'delta_non_valido' using errcode = '22023';
  end if;

  if p_delta > 0 then
    insert into public.deck_cards as c (deck_id, card_code, quantity)
    values (p_deck_id, p_card_code, p_delta)
    on conflict (deck_id, card_code)
      do update set quantity = least(c.quantity + excluded.quantity, 50)
    returning quantity into copie;
    return copie;
  end if;

  update public.deck_cards
  set quantity = quantity + p_delta
  where deck_id = p_deck_id and card_code = p_card_code and quantity + p_delta >= 1
  returning quantity into copie;
  if found then
    return copie;
  end if;

  delete from public.deck_cards where deck_id = p_deck_id and card_code = p_card_code;
  return 0;
end;
$$;

revoke all on function public.cambia_carte_mazzo(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.cambia_carte_mazzo(uuid, text, integer) to authenticated;

-- Duplica un proprio Deck: copia indipendente con "(copia)" nel nome. Restituisce il nuovo id.
create function public.duplica_mazzo(p_deck_id uuid)
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

  insert into public.deck_cards (deck_id, card_code, quantity, print_id)
  select nuovo, c.card_code, c.quantity, c.print_id
  from public.deck_cards c
  where c.deck_id = p_deck_id;

  return nuovo;
end;
$$;

revoke all on function public.duplica_mazzo(uuid) from public, anon, authenticated;
grant execute on function public.duplica_mazzo(uuid) to authenticated;
