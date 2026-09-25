-- Area Admin (RIB-19, ADR-0014): ruolo in app_metadata, sempre con la verifica in due passaggi,
-- registro delle azioni non modificabile, lettura dello stato dei job.

-- Il ruolo si legge da auth.users a ogni richiesta, non dal JWT: tolto il ruolo, lo si perde
-- subito. app_metadata lo scrive solo chi ha accesso al database (dashboard, service_role), mai
-- l'utente (user_metadata invece è modificabile da lui e qui non conta).
create function private.ha_ruolo_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select (u.raw_app_meta_data ->> 'admin')::boolean
      from auth.users u
      where u.id = auth.uid()
    ),
    false
  )
$$;

-- Admin operativo: ruolo, accesso valido (sessione ancora aperta) e codice dato in questa
-- sessione (aal2), anche se per gli altri utenti la verifica è facoltativa.
create function private.admin_attivo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.ha_ruolo_admin()
    and private.accesso_valido()
    and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

comment on function private.admin_attivo() is
  'Vero per un Admin con sessione valida e aal2. Da usare in tutte le policy admin.';

revoke all on function private.ha_ruolo_admin() from public, anon, authenticated;
revoke all on function private.admin_attivo() from public, anon, authenticated;
grant execute on function private.ha_ruolo_admin() to authenticated;
grant execute on function private.admin_attivo() to authenticated;

-- Per l'app: cosa mostrare nell'area Admin. 'no' = non è Admin; 'codice' = è Admin ma deve
-- attivare la verifica in due passaggi o dare il codice; 'ok' = area aperta.
create function public.stato_admin()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not private.ha_ruolo_admin() then 'no'
    when not private.admin_attivo() then 'codice'
    else 'ok'
  end
$$;

revoke all on function public.stato_admin() from public, anon, authenticated;
grant execute on function public.stato_admin() to authenticated;

-- Stato dei job: lo legge solo l'Admin attivo; scrive sempre e solo il job.
grant select on public.job_runs to authenticated;

create policy "L'Admin legge le esecuzioni dei job" on public.job_runs
  for select to authenticated
  using ((select private.admin_attivo()));

-- Registro delle azioni Admin: si può solo aggiungere.
create table public.admin_audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  -- Chi ha agito: nessun collegamento ad auth.users, così la riga resta anche se l'account
  -- viene eliminato. Null per le azioni fatte dalla dashboard (es. assegnare il ruolo).
  actor      uuid,
  action     text not null,
  table_name text not null,
  record_id  text,
  before     jsonb,
  after      jsonb
);

comment on table public.admin_audit_log is
  'Azioni Admin: chi, cosa, quando, prima e dopo. Non si modifica e non si cancella.';

create index admin_audit_log_at_idx on public.admin_audit_log (at desc);

alter table public.admin_audit_log enable row level security;

revoke all on public.admin_audit_log from anon, authenticated;
grant select on public.admin_audit_log to authenticated;

create policy "L'Admin legge il registro" on public.admin_audit_log
  for select to authenticated
  using ((select private.admin_attivo()));

-- Nessuno modifica o cancella le righe, nemmeno dalla dashboard o con service_role.
create function private.registro_non_modificabile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Il registro delle azioni Admin non si modifica e non si cancella'
    using errcode = '42501';
end;
$$;

create trigger admin_audit_log_no_update_delete
  before update or delete on public.admin_audit_log
  for each row execute function private.registro_non_modificabile();

create trigger admin_audit_log_no_truncate
  before truncate on public.admin_audit_log
  for each statement execute function private.registro_non_modificabile();

-- Trigger da mettere su ogni tabella gestita dall'Admin (Ban List, segnalazioni...):
--   create trigger <tabella>_audit after insert or update or delete on public.<tabella>
--     for each row execute function private.registra_azione_admin();
create function private.registra_azione_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  prima jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  dopo  jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  insert into public.admin_audit_log (actor, action, table_name, record_id, before, after)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_schema || '.' || tg_table_name,
    coalesce(dopo ->> 'id', prima ->> 'id'),
    prima,
    dopo
  );
  return null;
end;
$$;

revoke all on function private.registra_azione_admin() from public, anon, authenticated;
