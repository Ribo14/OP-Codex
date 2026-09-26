-- Explanation Report ed Explanation Request (RIB-54): un utente segnala che una Card Explanation
-- è sbagliata o poco chiara, oppure chiede la spiegazione di una carta che non ce l'ha. Le voci
-- finiscono nella coda dell'area Admin e si evadono nelle sessioni di sviluppo (ADR-0006).
-- Tabella personale (ADR-0013): cascade da auth.users e policy restrictive; l'Admin attivo
-- (ADR-0014) legge tutto e cambia solo lo stato, con ogni cambio nel registro delle azioni.

create table public.explanation_reports (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Nessuna chiave esterna verso cards: come FAQ e spiegazioni, lavora per Card Code.
  card_code  text not null
    constraint explanation_reports_card_code check (card_code ~ '^[A-Z0-9]+-[0-9]+$'),
  kind       text not null
    constraint explanation_reports_kind check (kind in ('report', 'request')),
  -- Solo per le segnalazioni.
  reason     text
    constraint explanation_reports_reason check (reason in ('wrong', 'unclear', 'other')),
  note       text
    constraint explanation_reports_note check (note is null or char_length(btrim(note)) between 1 and 500),
  status     text not null default 'open'
    constraint explanation_reports_status check (status in ('open', 'in_progress', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint explanation_reports_reason_only_report check ((kind = 'report') = (reason is not null))
);

comment on table public.explanation_reports is
  'Explanation Report (segnalazione) ed Explanation Request (richiesta) degli utenti, con lo stato della coda Admin.';

-- Una sola voce aperta per utente, carta e tipo: niente doppioni nella coda.
create unique index explanation_reports_one_open
  on public.explanation_reports (user_id, card_code, kind)
  where status in ('open', 'in_progress');

create index explanation_reports_status_idx on public.explanation_reports (status, card_code);

create trigger explanation_reports_touch_updated_at
  before update on public.explanation_reports
  for each row execute function public.profiles_touch_updated_at();

-- Limite per utente (ASVS V2.2.1, come per i mazzi): al massimo 10 voci nelle ultime 24 ore.
create function private.limite_segnalazioni()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('explanation_reports:' || new.user_id::text));
  if (
    select count(*) from public.explanation_reports
    where user_id = new.user_id and created_at > now() - interval '24 hours'
  ) >= 10 then
    raise exception 'troppe_segnalazioni' using errcode = '23514',
      detail = 'Al massimo 10 segnalazioni o richieste al giorno.';
  end if;
  return new;
end;
$$;

revoke all on function private.limite_segnalazioni() from public, anon, authenticated;

create trigger explanation_reports_limite_per_utente
  before insert on public.explanation_reports
  for each row execute function private.limite_segnalazioni();

alter table public.explanation_reports enable row level security;

create policy "Solo con un accesso valido" on public.explanation_reports
  as restrictive
  for all to authenticated
  using ((select private.accesso_valido()))
  with check ((select private.accesso_valido()));

create policy "Le proprie segnalazioni sono leggibili, l'Admin legge tutto" on public.explanation_reports
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.admin_attivo()));

create policy "Si segnala solo a proprio nome" on public.explanation_reports
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'open');

create policy "Solo l'Admin attivo cambia lo stato" on public.explanation_reports
  for update to authenticated
  using ((select private.admin_attivo()))
  with check ((select private.admin_attivo()));

revoke all on public.explanation_reports from anon, authenticated;
grant select on public.explanation_reports to authenticated;
grant insert (card_code, kind, reason, note) on public.explanation_reports to authenticated;
grant update (status) on public.explanation_reports to authenticated;

-- Ogni cambio di stato dell'Admin finisce nel registro delle azioni.
create trigger explanation_reports_audit
  after update on public.explanation_reports
  for each row execute function private.registra_azione_admin();
