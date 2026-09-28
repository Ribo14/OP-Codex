-- Rimuovi amico e User Block (RIB-72, ADR-0015). Le tabelle ci sono già (20260928100000); qui
-- solo le funzioni. Chi è bloccato non viene avvisato e non deve poterlo scoprire: ogni
-- risposta per lui è la stessa di uno Username inesistente.

-- Toglie l'amicizia; l'altro non viene avvisato.
create function public.rimuovi_amico(p_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.utente_amici();
  other uuid := private.altro_utente(me, p_username);
begin
  delete from public.friendships
  where user_a = least(me, other) and user_b = greatest(me, other);
  if not found then
    raise exception 'amico_non_trovato' using errcode = 'P0002';
  end if;
end;
$$;

-- Blocca: toglie l'amicizia e le richieste in corso, in entrambe le direzioni. Rifarlo non
-- cambia nulla. Se è l'altro ad aver bloccato, la risposta è quella di uno Username inesistente.
create function public.blocca_utente(p_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.utente_amici();
  other uuid;
begin
  if exists (
    select 1
    from public.user_blocks b
    join public.profiles p on p.id = b.blocked
    where b.blocker = me and lower(p.username) = lower(coalesce(p_username, ''))
  ) then
    return;
  end if;
  other := private.altro_utente(me, p_username);
  if other is null then
    raise exception 'utente_non_trovato' using errcode = 'P0002';
  end if;
  delete from public.friendships
  where user_a = least(me, other) and user_b = greatest(me, other);
  delete from public.friend_requests
  where (from_user = me and to_user = other) or (from_user = other and to_user = me);
  insert into public.user_blocks (blocker, blocked) values (me, other);
end;
$$;

-- Sblocca: l'altro può di nuovo trovarti e chiederti l'amicizia; l'amicizia non torna.
create function public.sblocca_utente(p_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.utente_amici();
begin
  delete from public.user_blocks b
  using public.profiles p
  where b.blocker = me
    and p.id = b.blocked
    and lower(p.username) = lower(coalesce(p_username, ''));
  if not found then
    raise exception 'blocco_non_trovato' using errcode = 'P0002';
  end if;
end;
$$;

-- Gli utenti che si sono bloccati, con lo Username (la tabella dei profili non è leggibile).
create function public.utenti_bloccati()
returns table (username text, dal timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := private.utente_amici();
begin
  return query
    select p.username, b.created_at
    from public.user_blocks b
    join public.profiles p on p.id = b.blocked
    where b.blocker = me
    order by lower(p.username);
end;
$$;

revoke all on function public.rimuovi_amico(text) from public, anon, authenticated;
revoke all on function public.blocca_utente(text) from public, anon, authenticated;
revoke all on function public.sblocca_utente(text) from public, anon, authenticated;
revoke all on function public.utenti_bloccati() from public, anon, authenticated;
grant execute on function public.rimuovi_amico(text) to authenticated;
grant execute on function public.blocca_utente(text) to authenticated;
grant execute on function public.sblocca_utente(text) to authenticated;
grant execute on function public.utenti_bloccati() to authenticated;
