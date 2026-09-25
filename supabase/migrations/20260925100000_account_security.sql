-- Sicurezza dell'account (RIB-18, ADR-0013): uscita da tutti i dispositivi immediata, verifica
-- in due passaggi fatta rispettare dal database, eliminazione dell'account.

create schema if not exists private;
comment on schema private is 'Funzioni di supporto alle policy RLS, fuori dalle API.';
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- Un accesso vale solo se:
--   * la sua sessione esiste ancora: "Esci" e "Esci da tutti i dispositivi" cancellano le
--     sessioni, e da quel momento anche i token già emessi smettono di aprire i dati personali;
--   * chi ha attivato la verifica in due passaggi ha inserito il codice (aal2).
-- security definer: legge auth.sessions e auth.mfa_factors, che authenticated non vede.
create function private.accesso_valido()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from auth.sessions s
      where s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
        and s.user_id = auth.uid()
        and (s.not_after is null or s.not_after > now())
    )
    and (
      coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
      or not exists (
        select 1
        from auth.mfa_factors f
        where f.user_id = auth.uid() and f.status = 'verified'
      )
    )
$$;

comment on function private.accesso_valido() is
  'Vero se la sessione del JWT esiste ancora e, per chi ha la verifica in due passaggi, è aal2. '
  'Da usare in una policy restrictive su ogni tabella con dati personali.';

revoke all on function private.accesso_valido() from public, anon, authenticated;
grant execute on function private.accesso_valido() to authenticated;

-- Ogni tabella con dati personali riceve questa policy restrictive, oltre alle sue policy.
create policy "Solo con un accesso valido" on public.profiles
  as restrictive
  for all to authenticated
  using ((select private.accesso_valido()))
  with check ((select private.accesso_valido()));

-- Eliminazione dell'account (GDPR): cancella l'utente che la chiama e, a cascata, tutti i suoi
-- dati. Ogni tabella personale, presente e futura, deve riferirsi ad auth.users con
-- on delete cascade (lo verifica un test in tests/db).
-- Chiede lo Username come conferma e un accesso fatto negli ultimi 10 minuti (con password,
-- Google o codice della verifica in due passaggi: gli orari stanno nel claim amr del JWT).
create function public.elimina_account(conferma_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  utente uuid := auth.uid();
  ultimo_accesso timestamptz;
begin
  if utente is null or not private.accesso_valido() then
    raise exception 'accesso_non_valido' using errcode = '42501';
  end if;

  select to_timestamp(max((voce ->> 'timestamp')::bigint))
    into ultimo_accesso
    from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) as voce;
  if ultimo_accesso is null or ultimo_accesso < now() - interval '10 minutes' then
    raise exception 'accesso_non_recente' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = utente and lower(p.username) = lower(coalesce(conferma_username, ''))
  ) then
    raise exception 'username_errato' using errcode = 'P0001';
  end if;

  delete from auth.users where id = utente;
end;
$$;

comment on function public.elimina_account(text) is
  'Elimina l''account di chi la chiama e tutti i suoi dati (RIB-18).';

revoke all on function public.elimina_account(text) from public, anon, authenticated;
grant execute on function public.elimina_account(text) to authenticated;
