-- Share Link dei Deck (RIB-26): un Deck si condivide con chiunque tramite un link con un token
-- casuale (128 bit), revocabile. Nessuna policy rende leggibili i Deck "pubblici": si legge solo
-- quello del token, tramite public.mazzo_condiviso.

-- Visibility: private (predefinita), link (Share Link attivo), friends (fase 6, non ancora usata).
alter table public.decks drop constraint decks_visibility;
alter table public.decks
  add constraint decks_visibility check (visibility in ('private', 'link', 'friends'));

alter table public.decks add column share_token text;
alter table public.decks
  add constraint decks_share_token_format check (share_token ~ '^[A-Za-z0-9_-]{22}$');
alter table public.decks
  add constraint decks_link_has_token check ((visibility = 'link') = (share_token is not null));
create unique index decks_share_token_key on public.decks (share_token) where share_token is not null;

comment on column public.decks.share_token is
  'Token dello Share Link (22 caratteri base64url, 128 bit casuali); null se il Deck non è condiviso.';

-- Il token non si scrive a mano: solo da queste funzioni (nessun grant di update sulla colonna).

-- Crea (o restituisce, se c'è già) lo Share Link di un proprio Deck.
create function public.crea_link_mazzo(p_deck_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  token text;
begin
  if auth.uid() is null or not private.accesso_valido() then
    raise exception 'accesso_non_valido' using errcode = '42501';
  end if;

  select d.share_token into token
  from public.decks d
  where d.id = p_deck_id and d.user_id = auth.uid();
  if not found then
    raise exception 'mazzo_non_trovato' using errcode = 'P0002';
  end if;
  if token is not null then
    return token;
  end if;

  token := rtrim(translate(encode(extensions.gen_random_bytes(16), 'base64'), '+/', '-_'), '=');
  update public.decks set visibility = 'link', share_token = token where id = p_deck_id;
  return token;
end;
$$;

-- Revoca lo Share Link: il vecchio link smette di funzionare; un link nuovo avrà un altro token.
create function public.revoca_link_mazzo(p_deck_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.accesso_valido() then
    raise exception 'accesso_non_valido' using errcode = '42501';
  end if;
  update public.decks
  set visibility = 'private', share_token = null
  where id = p_deck_id and user_id = auth.uid();
  if not found then
    raise exception 'mazzo_non_trovato' using errcode = 'P0002';
  end if;
end;
$$;

-- Lettura pubblica tramite token, anche senza account: solo quel Deck, solo se il link è attivo.
-- Restituisce null per un token sbagliato o revocato (nessuna differenza tra i due casi).
create function public.mazzo_condiviso(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', d.name,
    'leader_code', d.leader_code,
    'leader_print_id', d.leader_print_id,
    'format', d.format,
    'updated_at', d.updated_at,
    'username', p.username,
    'cards', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('card_code', c.card_code, 'quantity', c.quantity, 'print_id', c.print_id)
          order by c.card_code
        )
        from public.deck_cards c
        where c.deck_id = d.id
      ),
      '[]'::jsonb
    )
  )
  from public.decks d
  left join public.profiles p on p.id = d.user_id
  where p_token ~ '^[A-Za-z0-9_-]{22}$'
    and d.share_token = p_token
    and d.visibility = 'link'
$$;

revoke all on function public.crea_link_mazzo(uuid) from public, anon, authenticated;
revoke all on function public.revoca_link_mazzo(uuid) from public, anon, authenticated;
revoke all on function public.mazzo_condiviso(text) from public, anon, authenticated;
grant execute on function public.crea_link_mazzo(uuid) to authenticated;
grant execute on function public.revoca_link_mazzo(uuid) to authenticated;
grant execute on function public.mazzo_condiviso(text) to anon, authenticated;
