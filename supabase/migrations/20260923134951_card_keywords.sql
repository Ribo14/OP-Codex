-- Keyword delle Card (es. Rush, Blocker, On Play, DON!! x1), estratte dal Catalog Sync
-- dai termini tra parentesi quadre di effetto e Trigger che non sono nomi di carte.
-- Servono ai filtri del catalogo (RIB-15) e al glossario (fase 3).

alter table public.cards add column keywords text[] not null default '{}';

comment on column public.cards.keywords is
  'Keyword dell''effetto e del Trigger, es. {Rush,"On Play"}; calcolate dal Catalog Sync.';
