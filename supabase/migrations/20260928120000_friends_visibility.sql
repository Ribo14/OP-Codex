-- Visibility Friends (RIB-73, ADR-0015): Deck a tre livelli crescenti (private < friends < link)
-- e Collection Private/Friends. I dati di un amico si leggono solo da queste funzioni, non da
-- nuove policy: le liste dei propri dati (Mazzi, Collezione) leggono le tabelle affidandosi alle
-- policy, e una policy "amico" ci farebbe entrare i dati degli altri.

-- Collection: Private (predefinita) o Friends.
alter table public.profiles
  add column collection_visibility text not null default 'private'
    constraint profiles_collection_visibility check (collection_visibility in ('private', 'friends'));

comment on column public.profiles.collection_visibility is
  'Chi vede la Collection: private (solo il proprietario) o friends (anche gli amici, senza valore).';

grant update (collection_visibility) on public.profiles to authenticated;

-- Visibility di un proprio Deck. link crea (o tiene) lo Share Link; private e friends lo
-- revocano. Restituisce il token dello Share Link, o null.
create function public.imposta_visibilita_mazzo(p_deck_id uuid, p_visibility text)
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
  if p_visibility is null or p_visibility not in ('private', 'friends', 'link') then
    raise exception 'visibilita_non_valida' using errcode = '22023';
  end if;

  select d.share_token into token
  from public.decks d
  where d.id = p_deck_id and d.user_id = auth.uid();
  if not found then
    raise exception 'mazzo_non_trovato' using errcode = 'P0002';
  end if;

  if p_visibility = 'link' then
    if token is null then
      token := rtrim(translate(encode(extensions.gen_random_bytes(16), 'base64'), '+/', '-_'), '=');
    end if;
  else
    token := null;
  end if;
  update public.decks set visibility = p_visibility, share_token = token where id = p_deck_id;
  return token;
end;
$$;

-- L'amico dato lo Username: solo se c'è l'amicizia (che un blocco toglie). Null altrimenti.
create function private.amico(me uuid, p_username text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles p
  where lower(p.username) = lower(coalesce(p_username, ''))
    and p.id <> me
    and private.sono_amici(me, p.id)
$$;

revoke all on function private.amico(uuid, text) from public, anon, authenticated;

-- Il profilo di un amico: i suoi Deck Friends e Public Link (senza carte) e se la sua Collection
-- è visibile. Null se non siete amici: da fuori non si distingue da uno Username inesistente.
create function public.profilo_amico(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := private.utente_amici();
  other uuid := private.amico(me, p_username);
begin
  if other is null then
    return null;
  end if;
  return (
    select jsonb_build_object(
      'username', p.username,
      'collection_visible', p.collection_visibility = 'friends',
      'decks', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', d.id,
            'name', d.name,
            'leader_code', d.leader_code,
            'leader_print_id', d.leader_print_id,
            'format', d.format,
            'updated_at', d.updated_at,
            'card_count', coalesce(
              (select sum(c.quantity) from public.deck_cards c where c.deck_id = d.id), 0
            )
          )
          order by d.updated_at desc
        )
        from public.decks d
        where d.user_id = other and d.visibility in ('friends', 'link')
      ), '[]'::jsonb)
    )
    from public.profiles p
    where p.id = other
  );
end;
$$;

-- Un Deck di un amico, con le carte (stessa forma di mazzo_condiviso). Null se non siete amici o
-- se il Deck è privato.
create function public.mazzo_amico(p_deck_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := private.utente_amici();
begin
  return (
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
    join public.profiles p on p.id = d.user_id
    where d.id = p_deck_id
      and d.visibility in ('friends', 'link')
      and d.user_id <> me
      and private.sono_amici(me, d.user_id)
  );
end;
$$;

-- La Collection di un amico che l'ha resa visibile: solo Printing, lingua e copie. Nessuna riga
-- se non siete amici o se è privata.
create function public.collezione_amico(p_username text)
returns table (print_id text, language text, quantity integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := private.utente_amici();
  other uuid := private.amico(me, p_username);
begin
  if other is null then
    return;
  end if;
  return query
    select e.print_id, e.language, e.quantity
    from public.collection_entries e
    join public.profiles p on p.id = e.user_id
    where e.user_id = other and p.collection_visibility = 'friends'
    order by e.print_id, e.language;
end;
$$;

revoke all on function public.imposta_visibilita_mazzo(uuid, text) from public, anon, authenticated;
revoke all on function public.profilo_amico(text) from public, anon, authenticated;
revoke all on function public.mazzo_amico(uuid) from public, anon, authenticated;
revoke all on function public.collezione_amico(text) from public, anon, authenticated;
grant execute on function public.imposta_visibilita_mazzo(uuid, text) to authenticated;
grant execute on function public.profilo_amico(text) to authenticated;
grant execute on function public.mazzo_amico(uuid) to authenticated;
grant execute on function public.collezione_amico(text) to authenticated;
