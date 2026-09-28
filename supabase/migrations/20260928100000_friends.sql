-- Amici (RIB-71, fase 6, ADR-0015): Friend Request, Friendship, link di invito e le basi dello
-- User Block. Tabelle personali (ADR-0013): cascade da auth.users e policy restrictive.
-- Le scritture passano solo dalle funzioni qui sotto, che controllano blocchi e duplicati in un
-- solo posto. Verso l'app gli altri User sono sempre e solo il loro Username, mai l'id.

-- Richiesta in attesa: da chi, a chi.
create table public.friend_requests (
  from_user  uuid not null references auth.users (id) on delete cascade,
  to_user    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_user, to_user),
  constraint friend_requests_not_self check (from_user <> to_user)
);
create index friend_requests_to_user on public.friend_requests (to_user);

comment on table public.friend_requests is 'Friend Request in attesa di risposta.';

-- Amicizia: una riga per coppia, con user_a < user_b.
create table public.friendships (
  user_a     uuid not null references auth.users (id) on delete cascade,
  user_b     uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  constraint friendships_order check (user_a < user_b)
);
create index friendships_user_b on public.friendships (user_b);

comment on table public.friendships is 'Friendship tra due User (una riga per coppia, user_a < user_b).';

-- User Block: chi blocca, chi è bloccato. Si usa da RIB-72; qui serve già ai controlli.
create table public.user_blocks (
  blocker    uuid not null references auth.users (id) on delete cascade,
  blocked    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  constraint user_blocks_not_self check (blocker <> blocked)
);
create index user_blocks_blocked on public.user_blocks (blocked);

comment on table public.user_blocks is 'User Block: il blocked non trova il blocker e non gli chiede l''amicizia.';

-- Link di invito personale: token casuale (128 bit), rigenerabile.
create table public.friend_invites (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  token      text not null
    constraint friend_invites_token_format check (token ~ '^[A-Za-z0-9_-]{22}$'),
  created_at timestamptz not null default now()
);
create unique index friend_invites_token_key on public.friend_invites (token);

comment on table public.friend_invites is 'Link di invito personale di un User (token rigenerabile).';

-- RLS: ognuno legge solo le righe che lo riguardano; nessuna scrittura diretta.
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.user_blocks enable row level security;
alter table public.friend_invites enable row level security;

create policy "Solo con un accesso valido" on public.friend_requests
  as restrictive for all to authenticated
  using ((select private.accesso_valido())) with check ((select private.accesso_valido()));
create policy "Solo con un accesso valido" on public.friendships
  as restrictive for all to authenticated
  using ((select private.accesso_valido())) with check ((select private.accesso_valido()));
create policy "Solo con un accesso valido" on public.user_blocks
  as restrictive for all to authenticated
  using ((select private.accesso_valido())) with check ((select private.accesso_valido()));
create policy "Solo con un accesso valido" on public.friend_invites
  as restrictive for all to authenticated
  using ((select private.accesso_valido())) with check ((select private.accesso_valido()));

create policy "Le proprie richieste, inviate e ricevute" on public.friend_requests
  for select to authenticated
  using ((select auth.uid()) in (from_user, to_user));
create policy "Le proprie amicizie" on public.friendships
  for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));
-- Chi è bloccato non deve saperlo: vede solo i blocchi che ha messo lui.
create policy "I blocchi messi da sé" on public.user_blocks
  for select to authenticated
  using (blocker = (select auth.uid()));
create policy "Il proprio link di invito" on public.friend_invites
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.friend_requests, public.friendships, public.user_blocks, public.friend_invites
  from anon, authenticated;
grant select on public.friend_requests, public.friendships, public.user_blocks, public.friend_invites
  to authenticated;

-- Supporto alle policy e alle funzioni.
create function private.sono_amici(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.user_a = least(a, b) and f.user_b = greatest(a, b)
  )
$$;

create function private.bloccati(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_blocks u
    where (u.blocker = a and u.blocked = b) or (u.blocker = b and u.blocked = a)
  )
$$;

revoke all on function private.sono_amici(uuid, uuid) from public, anon, authenticated;
revoke all on function private.bloccati(uuid, uuid) from public, anon, authenticated;
grant execute on function private.sono_amici(uuid, uuid) to authenticated;
grant execute on function private.bloccati(uuid, uuid) to authenticated;

-- Chi chiama: accesso valido e Username già scelto; altrimenti errore.
create function private.utente_amici()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.accesso_valido() then
    raise exception 'accesso_non_valido' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = auth.uid()) then
    raise exception 'username_mancante' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

-- L'altro User dato lo Username esatto (maiuscole indifferenti). Null se non esiste, se è chi
-- chiama o se c'è un blocco tra i due: da fuori i tre casi sono indistinguibili.
create function private.altro_utente(me uuid, p_username text)
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
    and not private.bloccati(me, p.id)
$$;

-- Il rapporto tra due User, come lo vede `me`.
create function private.rapporto(me uuid, other uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when private.sono_amici(me, other) then 'amico'
    when exists (select 1 from public.friend_requests r where r.from_user = me and r.to_user = other)
      then 'inviata'
    when exists (select 1 from public.friend_requests r where r.from_user = other and r.to_user = me)
      then 'ricevuta'
    else 'nessuno'
  end
$$;

revoke all on function private.utente_amici() from public, anon, authenticated;
revoke all on function private.altro_utente(uuid, text) from public, anon, authenticated;
revoke all on function private.rapporto(uuid, uuid) from public, anon, authenticated;

-- Crea l'amicizia e toglie le richieste tra i due, in entrambe le direzioni.
create function private.diventa_amico(a uuid, b uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.friend_requests
  where (from_user = a and to_user = b) or (from_user = b and to_user = a);
  insert into public.friendships (user_a, user_b)
  values (least(a, b), greatest(a, b))
  on conflict do nothing;
$$;

revoke all on function private.diventa_amico(uuid, uuid) from public, anon, authenticated;

-- Ricerca per Username esatto: lo Username come è scritto e il rapporto, oppure nessuna riga.
create function public.cerca_utente(p_username text)
returns table (username text, rapporto text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := private.utente_amici();
  other uuid := private.altro_utente(me, p_username);
begin
  if other is null then
    return;
  end if;
  return query
    select p.username, private.rapporto(me, other) from public.profiles p where p.id = other;
end;
$$;

-- Al massimo 50 richieste in attesa inviate, contro lo spam.
create function public.invia_richiesta_amicizia(p_username text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.utente_amici();
  other uuid := private.altro_utente(me, p_username);
  stato text;
begin
  if other is null then
    raise exception 'utente_non_trovato' using errcode = 'P0002';
  end if;
  stato := private.rapporto(me, other);
  if stato in ('amico', 'inviata') then
    return stato;
  end if;
  -- L'altro aveva già chiesto: le due richieste si incontrano e si diventa amici.
  if stato = 'ricevuta' then
    perform private.diventa_amico(me, other);
    return 'amico';
  end if;
  if (select count(*) from public.friend_requests r where r.from_user = me) >= 50 then
    raise exception 'troppe_richieste' using errcode = 'P0001';
  end if;
  insert into public.friend_requests (from_user, to_user) values (me, other);
  return 'inviata';
end;
$$;

create function public.accetta_richiesta_amicizia(p_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.utente_amici();
  other uuid := private.altro_utente(me, p_username);
begin
  if other is null or private.rapporto(me, other) <> 'ricevuta' then
    raise exception 'richiesta_non_trovata' using errcode = 'P0002';
  end if;
  perform private.diventa_amico(me, other);
end;
$$;

create function public.rifiuta_richiesta_amicizia(p_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.utente_amici();
  other uuid := private.altro_utente(me, p_username);
begin
  delete from public.friend_requests where from_user = other and to_user = me;
  if not found then
    raise exception 'richiesta_non_trovata' using errcode = 'P0002';
  end if;
end;
$$;

create function public.annulla_richiesta_amicizia(p_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.utente_amici();
  other uuid := private.altro_utente(me, p_username);
begin
  delete from public.friend_requests where from_user = me and to_user = other;
  if not found then
    raise exception 'richiesta_non_trovata' using errcode = 'P0002';
  end if;
end;
$$;

-- La pagina Amici in una chiamata: amici, richieste ricevute e inviate, con gli Username.
create function public.stato_amici()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := private.utente_amici();
begin
  return jsonb_build_object(
    'amici', coalesce((
      select jsonb_agg(jsonb_build_object('username', p.username, 'dal', f.created_at)
                       order by lower(p.username))
      from public.friendships f
      join public.profiles p on p.id = case when f.user_a = me then f.user_b else f.user_a end
      where me in (f.user_a, f.user_b)
    ), '[]'::jsonb),
    'ricevute', coalesce((
      select jsonb_agg(jsonb_build_object('username', p.username, 'il', r.created_at)
                       order by r.created_at desc)
      from public.friend_requests r
      join public.profiles p on p.id = r.from_user
      where r.to_user = me
    ), '[]'::jsonb),
    'inviate', coalesce((
      select jsonb_agg(jsonb_build_object('username', p.username, 'il', r.created_at)
                       order by r.created_at desc)
      from public.friend_requests r
      join public.profiles p on p.id = r.to_user
      where r.from_user = me
    ), '[]'::jsonb)
  );
end;
$$;

-- Link di invito: lo crea la prima volta, poi restituisce sempre lo stesso finché non si rigenera.
create function public.link_invito_amici()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.utente_amici();
  result text;
begin
  select i.token into result from public.friend_invites i where i.user_id = me;
  if result is null then
    result := rtrim(translate(encode(extensions.gen_random_bytes(16), 'base64'), '+/', '-_'), '=');
    insert into public.friend_invites (user_id, token) values (me, result);
  end if;
  return result;
end;
$$;

-- Nuovo token: il vecchio link smette di funzionare.
create function public.rigenera_link_invito_amici()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.utente_amici();
  result text := rtrim(translate(encode(extensions.gen_random_bytes(16), 'base64'), '+/', '-_'), '=');
begin
  insert into public.friend_invites (user_id, token) values (me, result)
  on conflict (user_id) do update set token = excluded.token, created_at = now();
  return result;
end;
$$;

-- Chi ha invitato, dato il token: Username e rapporto. Nessuna riga per un token sbagliato o
-- vecchio, per il proprio link e se c'è un blocco tra i due.
create function public.utente_da_invito(p_token text)
returns table (username text, rapporto text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := private.utente_amici();
  other uuid;
begin
  select i.user_id into other
  from public.friend_invites i
  where p_token ~ '^[A-Za-z0-9_-]{22}$' and i.token = p_token;
  if other is null or other = me or private.bloccati(me, other) then
    return;
  end if;
  return query
    select p.username, private.rapporto(me, other) from public.profiles p where p.id = other;
end;
$$;

revoke all on function public.cerca_utente(text) from public, anon, authenticated;
revoke all on function public.invia_richiesta_amicizia(text) from public, anon, authenticated;
revoke all on function public.accetta_richiesta_amicizia(text) from public, anon, authenticated;
revoke all on function public.rifiuta_richiesta_amicizia(text) from public, anon, authenticated;
revoke all on function public.annulla_richiesta_amicizia(text) from public, anon, authenticated;
revoke all on function public.stato_amici() from public, anon, authenticated;
revoke all on function public.link_invito_amici() from public, anon, authenticated;
revoke all on function public.rigenera_link_invito_amici() from public, anon, authenticated;
revoke all on function public.utente_da_invito(text) from public, anon, authenticated;
grant execute on function public.cerca_utente(text) to authenticated;
grant execute on function public.invia_richiesta_amicizia(text) to authenticated;
grant execute on function public.accetta_richiesta_amicizia(text) to authenticated;
grant execute on function public.rifiuta_richiesta_amicizia(text) to authenticated;
grant execute on function public.annulla_richiesta_amicizia(text) to authenticated;
grant execute on function public.stato_amici() to authenticated;
grant execute on function public.link_invito_amici() to authenticated;
grant execute on function public.rigenera_link_invito_amici() to authenticated;
grant execute on function public.utente_da_invito(text) to authenticated;
