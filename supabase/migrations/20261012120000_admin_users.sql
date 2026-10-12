-- Area Admin rinnovata (RIB-89, ADR-0014): panoramica con i numeri dell'app e lo stato dei job,
-- elenco degli utenti, sospensione e chiusura delle sessioni.
-- Tutto passa da funzioni security definer: auth.users e auth.sessions restano invisibili
-- all'app, e ogni funzione controlla da sé che chi la chiama sia un Admin attivo (aal2).
-- Niente eliminazione degli account né cambio di ruolo dall'app: solo dalla dashboard.

create function private.richiedi_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.admin_attivo() then
    raise exception 'solo_admin' using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.richiedi_admin() from public, anon, authenticated;
grant execute on function private.richiedi_admin() to authenticated;

-- I numeri della panoramica e, per ogni job, l'ultima esecuzione e l'ultima riuscita.
create function public.admin_panoramica()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.richiedi_admin();
  return jsonb_build_object(
    'users', (select count(*) from auth.users),
    'users_new_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'users_active_7d',
      (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'users_suspended', (select count(*) from auth.users where banned_until > now()),
    'decks', (select count(*) from public.decks),
    'collection_copies', (select coalesce(sum(quantity), 0) from public.collection_entries),
    'open_reports',
      (select count(*) from public.explanation_reports where status in ('open', 'in_progress')),
    'jobs', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'job', ultimo.job,
            'status', ultimo.status,
            'started_at', ultimo.started_at,
            'finished_at', ultimo.finished_at,
            'error', ultimo.error,
            'last_success_at', (
              select max(r.finished_at)
              from public.job_runs r
              where r.job = ultimo.job and r.status = 'success'
            )
          )
          order by ultimo.job
        )
        from (
          select distinct on (job) job, status, started_at, finished_at, error
          from public.job_runs
          order by job, started_at desc
        ) ultimo
      ),
      '[]'::jsonb
    )
  );
end;
$$;

-- Elenco degli utenti, senza email (si vede solo nel dettaglio).
create function public.admin_utenti()
returns table (
  id uuid,
  username text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  mfa boolean,
  admin boolean,
  suspended boolean,
  decks bigint,
  copies bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.richiedi_admin();
  return query
    select
      u.id,
      p.username,
      u.created_at,
      u.last_sign_in_at,
      exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status = 'verified'),
      coalesce((u.raw_app_meta_data ->> 'admin')::boolean, false),
      coalesce(u.banned_until > now(), false),
      (select count(*) from public.decks d where d.user_id = u.id),
      (select coalesce(sum(c.quantity), 0)::bigint from public.collection_entries c where c.user_id = u.id)
    from auth.users u
    left join public.profiles p on p.id = u.id
    order by u.created_at desc;
end;
$$;

-- Dettaglio di un utente: in più l'email, i metodi di accesso e le sessioni aperte.
create function public.admin_utente(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  risultato jsonb;
begin
  perform private.richiedi_admin();
  select jsonb_build_object(
    'id', u.id,
    'username', p.username,
    'email', u.email,
    'providers', coalesce(u.raw_app_meta_data -> 'providers', '[]'::jsonb),
    'created_at', u.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'mfa', exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status = 'verified'),
    'admin', coalesce((u.raw_app_meta_data ->> 'admin')::boolean, false),
    'suspended', coalesce(u.banned_until > now(), false),
    'sessions', (
      select count(*) from auth.sessions s
      where s.user_id = u.id and (s.not_after is null or s.not_after > now())
    ),
    'decks', (select count(*) from public.decks d where d.user_id = u.id),
    'copies', (select coalesce(sum(c.quantity), 0) from public.collection_entries c where c.user_id = u.id)
  )
  into risultato
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = p_id;
  if risultato is null then
    raise exception 'utente_inesistente' using errcode = 'P0001';
  end if;
  return risultato;
end;
$$;

-- Le azioni valgono solo verso utenti normali: mai su se stessi né su un altro Admin.
create function private.utente_gestibile(p_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ruolo boolean;
begin
  if p_id = auth.uid() then
    raise exception 'non_su_se_stessi' using errcode = 'P0001';
  end if;
  select coalesce((raw_app_meta_data ->> 'admin')::boolean, false) into ruolo
    from auth.users where id = p_id;
  if not found then
    raise exception 'utente_inesistente' using errcode = 'P0001';
  end if;
  if ruolo then
    raise exception 'admin_protetto' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function private.utente_gestibile(uuid) from public, anon, authenticated;
grant execute on function private.utente_gestibile(uuid) to authenticated;

-- Sospende (banned_until nel futuro: Supabase Auth rifiuta accessi e rinnovi) o riattiva.
-- Sospendendo si chiudono anche le sessioni: i token già emessi smettono subito di aprire i
-- dati personali (private.accesso_valido).
create function public.admin_sospendi_utente(p_id uuid, p_sospeso boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  prima timestamptz;
  dopo timestamptz := case when p_sospeso then now() + interval '100 years' end;
  chiuse integer := 0;
begin
  perform private.richiedi_admin();
  perform private.utente_gestibile(p_id);

  select banned_until into prima from auth.users where id = p_id for update;
  update auth.users set banned_until = dopo where id = p_id;
  if p_sospeso then
    delete from auth.sessions where user_id = p_id;
    get diagnostics chiuse = row_count;
  end if;

  insert into public.admin_audit_log (actor, action, table_name, record_id, before, after)
  values (
    auth.uid(),
    case when p_sospeso then 'suspend_user' else 'reactivate_user' end,
    'auth.users',
    p_id::text,
    jsonb_build_object('banned_until', prima),
    jsonb_build_object('banned_until', dopo, 'closed_sessions', chiuse)
  );
end;
$$;

-- Chiude tutte le sessioni di un utente: dovrà accedere di nuovo su ogni dispositivo.
create function public.admin_chiudi_sessioni(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  chiuse integer;
begin
  perform private.richiedi_admin();
  perform private.utente_gestibile(p_id);

  delete from auth.sessions where user_id = p_id;
  get diagnostics chiuse = row_count;

  insert into public.admin_audit_log (actor, action, table_name, record_id, before, after)
  values (
    auth.uid(),
    'close_sessions',
    'auth.sessions',
    p_id::text,
    null,
    jsonb_build_object('closed_sessions', chiuse)
  );
  return chiuse;
end;
$$;

revoke all on function public.admin_panoramica() from public, anon, authenticated;
revoke all on function public.admin_utenti() from public, anon, authenticated;
revoke all on function public.admin_utente(uuid) from public, anon, authenticated;
revoke all on function public.admin_sospendi_utente(uuid, boolean) from public, anon, authenticated;
revoke all on function public.admin_chiudi_sessioni(uuid) from public, anon, authenticated;
grant execute on function public.admin_panoramica() to authenticated;
grant execute on function public.admin_utenti() to authenticated;
grant execute on function public.admin_utente(uuid) to authenticated;
grant execute on function public.admin_sospendi_utente(uuid, boolean) to authenticated;
grant execute on function public.admin_chiudi_sessioni(uuid) to authenticated;
