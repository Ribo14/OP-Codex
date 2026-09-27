-- Prezzi (RIB-32, ADR-0008): il Price Sync notturno legge i file pubblici di Cardmarket, abbina
-- ogni Printing al suo prodotto (Price Mapper, catalog-sync/price-mapper.ts) e salva:
-- - printing_prices: l'ultimo prezzo di ogni Printing, letto dall'app con il catalogo (anche
--   offline, aggiornamento incrementale su updated_at);
-- - price_snapshots: lo storico per il grafico, un giorno per riga, 90 giorni poi un lunedì a
--   settimana (la pulizia la fa il job).
-- Tutto è scritto dal job (connessione diretta al database); i Mapping Override dall'Admin.
-- `marketplace` prepara CardTrader (slice 5.5): per ora c'è solo Cardmarket.

-- Prodotti Cardmarket inglesi con Card Code: i candidati per i Mapping Override dell'Admin.
create table public.cardmarket_products (
  id_product   integer primary key,
  card_code    text not null
    constraint cardmarket_products_card_code check (card_code ~ '^[A-Z0-9]+-[0-9]+$'),
  name         text not null,
  id_expansion integer not null,
  -- Prezzi del listino, in euro: aiutano l'Admin a riconoscere base e parallele.
  trend        numeric(10, 2) constraint cardmarket_products_trend check (trend >= 0),
  low          numeric(10, 2) constraint cardmarket_products_low check (low >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.cardmarket_products is
  'Prodotti Cardmarket (gioco 18, espansioni inglesi) con Card Code nel nome: candidati per i Mapping Override.';

create index cardmarket_products_card_code_idx on public.cardmarket_products (card_code);

-- Abbinamento Printing → prodotto, ricalcolato a ogni Price Sync.
create table public.price_mappings (
  print_id    text not null references public.printings (print_id),
  marketplace text not null constraint price_mappings_marketplace check (marketplace in ('cardmarket')),
  product_id  integer not null,
  source      text not null constraint price_mappings_source check (source in ('auto', 'override')),
  -- 'check': abbinamento automatico plausibile ma da controllare (per la coda dell'Admin).
  confidence  text not null constraint price_mappings_confidence check (confidence in ('high', 'check')),
  updated_at  timestamptz not null default now(),
  primary key (print_id, marketplace)
);

comment on table public.price_mappings is
  'Price Mapping: il prodotto del Marketplace di ogni Printing (automatico o da Mapping Override).';

-- Mapping Override dell'Admin: prevalgono sempre; product_id null = "nessun prodotto".
create table public.mapping_overrides (
  print_id    text not null references public.printings (print_id),
  marketplace text not null constraint mapping_overrides_marketplace check (marketplace in ('cardmarket')),
  product_id  integer
    constraint mapping_overrides_product_id check (product_id is null or product_id > 0),
  note        text constraint mapping_overrides_note check (char_length(note) <= 200),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (print_id, marketplace)
);

comment on table public.mapping_overrides is
  'Mapping Override: abbinamento impostato a mano dall''Admin, product_id null = nessun prodotto.';

create trigger mapping_overrides_touch_updated_at
  before update on public.mapping_overrides
  for each row execute function public.profiles_touch_updated_at();

-- Ultimo prezzo di ogni Printing. Una Printing che perde l'abbinamento resta con i prezzi a null
-- invece di sparire: l'aggiornamento incrementale del dispositivo non vede le righe cancellate.
create table public.printing_prices (
  print_id    text not null references public.printings (print_id),
  marketplace text not null constraint printing_prices_marketplace check (marketplace in ('cardmarket')),
  product_id  integer,
  -- Euro. trend = prezzo di tendenza, low = minimo in vendita.
  trend       numeric(10, 2) constraint printing_prices_trend check (trend >= 0),
  low         numeric(10, 2) constraint printing_prices_low check (low >= 0),
  -- Giorno del listino di Cardmarket da cui vengono i prezzi.
  price_date  date,
  updated_at  timestamptz not null default now(),
  primary key (print_id, marketplace)
);

comment on table public.printing_prices is
  'Ultimo Price Snapshot di ogni Printing, in euro; letto dall''app insieme al catalogo.';

create index printing_prices_updated_at_idx on public.printing_prices (updated_at);

-- Storico: un Price Snapshot per Printing, Marketplace e giorno.
create table public.price_snapshots (
  print_id    text not null references public.printings (print_id),
  marketplace text not null constraint price_snapshots_marketplace check (marketplace in ('cardmarket')),
  day         date not null,
  trend       numeric(10, 2) constraint price_snapshots_trend check (trend >= 0),
  low         numeric(10, 2) constraint price_snapshots_low check (low >= 0),
  primary key (print_id, marketplace, day)
);

comment on table public.price_snapshots is
  'Price Snapshot giornalieri in euro: 90 giorni, poi uno a settimana (lunedì).';

-- Row Level Security (ADR-0003).
alter table public.cardmarket_products enable row level security;
alter table public.price_mappings enable row level security;
alter table public.mapping_overrides enable row level security;
alter table public.printing_prices enable row level security;
alter table public.price_snapshots enable row level security;

revoke all on public.cardmarket_products, public.price_mappings, public.mapping_overrides,
  public.printing_prices, public.price_snapshots from anon, authenticated;

-- Prezzi e storico: pubblici come il catalogo.
create policy "Prezzi leggibili da tutti" on public.printing_prices
  for select to anon, authenticated using (true);
create policy "Storico dei prezzi leggibile da tutti" on public.price_snapshots
  for select to anon, authenticated using (true);
grant select on public.printing_prices, public.price_snapshots to anon, authenticated;

-- Prodotti e abbinamenti: li consulta solo l'Admin attivo, per correggere gli abbinamenti.
create policy "L'Admin legge i prodotti Cardmarket" on public.cardmarket_products
  for select to authenticated using ((select private.admin_attivo()));
create policy "L'Admin legge gli abbinamenti" on public.price_mappings
  for select to authenticated using ((select private.admin_attivo()));
grant select on public.cardmarket_products, public.price_mappings to authenticated;

-- Override: li gestisce solo l'Admin attivo, con ogni modifica nel registro delle azioni Admin.
create policy "Solo l'Admin attivo gestisce i Mapping Override" on public.mapping_overrides
  for all to authenticated
  using ((select private.admin_attivo()))
  with check ((select private.admin_attivo()));
grant select, delete on public.mapping_overrides to authenticated;
grant insert (print_id, marketplace, product_id, note) on public.mapping_overrides to authenticated;
grant update (product_id, note) on public.mapping_overrides to authenticated;

create trigger mapping_overrides_audit
  after insert or update or delete on public.mapping_overrides
  for each row execute function private.registra_azione_admin();

alter table public.job_runs drop constraint job_runs_job_check;
alter table public.job_runs
  add constraint job_runs_job_check
  check (job in ('catalog_sync', 'image_sync', 'faq_sync', 'explanation_sync', 'price_sync'));
