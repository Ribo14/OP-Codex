-- Catalogo: Set, Card e Printing alimentati dal Catalog Sync (ADR-0004).
-- Lettura pubblica; scrittura solo dal Catalog Sync (service_role o connessione diretta al DB).

create table public.sets (
  series_id    integer primary key,
  code         text not null unique,
  name         text not null,
  product_type text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.sets is 'Set della Official Card List; series_id è l''identificativo del sito ufficiale.';

create table public.cards (
  card_code  text primary key check (card_code ~ '^[A-Z0-9]+-[0-9]+$'),
  name       text not null,
  category   text not null check (category in ('Leader', 'Character', 'Event', 'Stage', 'DON!!')),
  cost       smallint check (cost >= 0),
  life       smallint check (life >= 0),
  power      integer check (power >= 0),
  counter    integer check (counter >= 0),
  attributes text[] not null default '{}',
  colors     text[] not null default '{}',
  types      text[] not null default '{}',
  block      smallint check (block >= 0),
  effect     text,
  trigger    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cards is 'Card come regole, identificata dal Card Code (es. OP01-001).';

create table public.printings (
  print_id   text primary key check (print_id ~ '^[A-Z0-9]+-[0-9]+(_[pr][0-9]+)?$'),
  card_code  text not null references public.cards (card_code),
  series_id  integer not null references public.sets (series_id),
  rarity     text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Il Print ID è il Card Code più un eventuale suffisso _pN (parallel) o _rN (ristampa).
  constraint printings_print_id_matches_card check (
    print_id = card_code or print_id like card_code || '\_%'
  )
);

comment on table public.printings is 'Printing di una Card, identificata dal Print ID (es. OP01-001_p1).';

create index printings_card_code_idx on public.printings (card_code);
create index printings_series_id_idx on public.printings (series_id);

-- Row Level Security: negazione di default, poi solo lettura (ADR-0003).
alter table public.sets enable row level security;
alter table public.cards enable row level security;
alter table public.printings enable row level security;

create policy "Set leggibili da tutti" on public.sets
  for select to anon, authenticated using (true);
create policy "Card leggibili da tutti" on public.cards
  for select to anon, authenticated using (true);
create policy "Printing leggibili da tutti" on public.printings
  for select to anon, authenticated using (true);

-- Difesa in profondità: oltre a non avere policy di scrittura, i ruoli pubblici
-- non hanno proprio il permesso di scrivere su queste tabelle.
revoke insert, update, delete, truncate, references, trigger
  on public.sets, public.cards, public.printings
  from anon, authenticated;
