-- Profilo di ogni User (RIB-14): per ora solo lo Username, scelto al primo accesso.
-- La riga nasce quando l'utente sceglie lo Username; l'account (auth.users) esiste già.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Come l'ha scritto l'utente (es. "Ribo"); l'unicità ignora maiuscole e minuscole.
  username text not null
    constraint profiles_username_format check (username ~ '^[A-Za-z0-9_]{3,20}$')
    constraint profiles_username_reserved check (
      lower(username) not in (
        'admin', 'administrator', 'amministratore', 'moderator', 'moderatore', 'mod',
        'opcodex', 'op_codex', 'support', 'supporto', 'staff', 'system', 'root', 'bandai'
      )
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Profilo pubblico di un User (per ora solo lo Username).';
comment on column public.profiles.username is
  'Username: 3-20 tra lettere, cifre e _, univoco senza distinzione tra maiuscole e minuscole.';

create unique index profiles_username_lower_key on public.profiles (lower(username));

create function public.profiles_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.profiles_touch_updated_at();

-- Row Level Security (ADR-0003): ognuno vede e modifica solo il proprio profilo.
-- Lo Username non è ancora ricercabile dagli altri: arriverà con gli amici (fase 6).
alter table public.profiles enable row level security;

create policy "Il proprio profilo è leggibile" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "Si crea solo il proprio profilo" on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy "Si modifica solo il proprio profilo" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Difesa in profondità: anon non tocca la tabella; authenticated può scrivere solo
-- id (all'inserimento) e username. Niente delete: l'account si eliminerà con RIB-18.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, username) on public.profiles to authenticated;
grant update (username) on public.profiles to authenticated;
