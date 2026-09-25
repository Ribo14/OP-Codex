-- Ban List (RIB-29): carte bandite, limitate e coppie bandite, per Card Code (parallel comprese).
-- Lettura pubblica; scrittura solo dall'Admin attivo (ADR-0014), con ogni modifica nel registro.

create table public.ban_list_entries (
  id             bigint generated always as identity primary key,
  -- Nessuna chiave esterna verso cards: una voce può precedere il Catalog Sync della carta.
  card_code      text not null
    constraint ban_list_card_code check (card_code ~ '^[A-Z0-9]+-[0-9]+$'),
  kind           text not null
    constraint ban_list_kind check (kind in ('banned', 'restricted', 'pair')),
  -- Solo per le limitate: copie consentite.
  max_copies     integer
    constraint ban_list_max_copies check (max_copies between 0 and 3),
  -- Solo per le coppie: l'altra carta (in ordine, così una coppia non si registra due volte).
  pair_code      text
    constraint ban_list_pair_code check (pair_code ~ '^[A-Z0-9]+-[0-9]+$'),
  effective_from date not null,
  source         text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint ban_list_restricted_has_max check ((kind = 'restricted') = (max_copies is not null)),
  constraint ban_list_pair_has_code check ((kind = 'pair') = (pair_code is not null)),
  constraint ban_list_pair_order check (pair_code is null or card_code < pair_code)
);

comment on table public.ban_list_entries is
  'Ban List ufficiale: bandite, limitate (max_copies) e coppie bandite (pair_code), dalla data di entrata in vigore.';

create unique index ban_list_entries_unique
  on public.ban_list_entries (card_code, kind, coalesce(pair_code, ''));

create trigger ban_list_entries_touch_updated_at
  before update on public.ban_list_entries
  for each row execute function public.profiles_touch_updated_at();

alter table public.ban_list_entries enable row level security;

create policy "Ban List leggibile da tutti" on public.ban_list_entries
  for select to anon, authenticated
  using (true);

create policy "Solo l'Admin attivo modifica la Ban List" on public.ban_list_entries
  for all to authenticated
  using ((select private.admin_attivo()))
  with check ((select private.admin_attivo()));

revoke all on public.ban_list_entries from anon, authenticated;
grant select on public.ban_list_entries to anon, authenticated;
grant insert (card_code, kind, max_copies, pair_code, effective_from, source)
  on public.ban_list_entries to authenticated;
grant update (card_code, kind, max_copies, pair_code, effective_from, source)
  on public.ban_list_entries to authenticated;
grant delete on public.ban_list_entries to authenticated;

-- Dati iniziali: "Banned/Restricted Card Addition Notice" del 24/09/2026
-- (docs/Regole One Piece Card/...-24-09.pdf). Le voci già in vigore hanno la data dell'avviso;
-- Dracule Mihawk entra in vigore il 12/10/2026. Nessuna carta limitata.
insert into public.ban_list_entries (card_code, kind, pair_code, effective_from, source)
values
  ('OP06-047', 'banned', null, '2026-09-24', 'Avviso ufficiale del 24/09/2026'),
  ('OP03-040', 'banned', null, '2026-09-24', 'Avviso ufficiale del 24/09/2026'),
  ('OP06-086', 'banned', null, '2026-09-24', 'Avviso ufficiale del 24/09/2026'),
  ('ST10-001', 'banned', null, '2026-09-24', 'Avviso ufficiale del 24/09/2026'),
  ('OP06-116', 'banned', null, '2026-09-24', 'Avviso ufficiale del 24/09/2026'),
  ('OP14-020', 'banned', null, '2026-10-12', 'Avviso ufficiale del 24/09/2026, in vigore dal 12/10/2026'),
  ('EB04-058', 'pair', 'OP07-115', '2026-09-24', 'Avviso ufficiale del 24/09/2026'),
  ('OP11-040', 'pair', 'OP11-067', '2026-09-24', 'Avviso ufficiale del 24/09/2026'),
  ('OP08-069', 'pair', 'OP11-040', '2026-09-24', 'Avviso ufficiale del 24/09/2026');

-- Da qui in poi ogni modifica finisce nel registro delle azioni Admin.
create trigger ban_list_entries_audit
  after insert or update or delete on public.ban_list_entries
  for each row execute function private.registra_azione_admin();
