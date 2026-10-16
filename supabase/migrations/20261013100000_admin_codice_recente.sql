-- Area Admin: il codice della verifica in due passaggi vale 12 ore (RIB-98, ADR-0014).
-- Una sessione aal2 si rinnova col refresh token senza scadenza (il limite di durata delle
-- sessioni è un'opzione a pagamento di Supabase): un token Admin rubato varrebbe per sempre.
-- Il claim amr del JWT dice quando è stato dato l'ultimo codice TOTP (Supabase Auth lo aggiorna
-- a ogni nuovo codice e lo conserva nei rinnovi): oltre le 12 ore l'area chiede il codice.

create function private.codice_recente()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from jsonb_array_elements(
      case
        when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then auth.jwt() -> 'amr'
        else '[]'::jsonb
      end
    ) as m
    where m ->> 'method' = 'totp'
      and (m ->> 'timestamp') ~ '^[0-9]+$'
      and to_timestamp((m ->> 'timestamp')::bigint) > now() - interval '12 hours'
  )
$$;

comment on function private.codice_recente() is
  'Vero se nel JWT c''è un codice TOTP dato nelle ultime 12 ore.';

revoke all on function private.codice_recente() from public, anon, authenticated;
grant execute on function private.codice_recente() to authenticated;

-- Stesso controllo di prima, più il codice recente: vale per tutte le policy e le funzioni Admin.
create or replace function private.admin_attivo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.ha_ruolo_admin()
    and private.accesso_valido()
    and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and private.codice_recente()
$$;

comment on function private.admin_attivo() is
  'Vero per un Admin con sessione valida, aal2 e codice dato nelle ultime 12 ore. Da usare in tutte le policy admin.';

-- 'rinnova' = Admin con il codice dato più di 12 ore fa: l'app lo chiede di nuovo sul posto.
create or replace function public.stato_admin()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not private.ha_ruolo_admin() then 'no'
    when private.admin_attivo() then 'ok'
    when private.accesso_valido() and coalesce(auth.jwt() ->> 'aal', '') = 'aal2' then 'rinnova'
    else 'codice'
  end
$$;
