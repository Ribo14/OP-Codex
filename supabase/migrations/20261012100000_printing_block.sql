-- RIB-76: il Block stampato su ogni Printing. Le ristampe possono avere un Block più recente
-- della stampa base (es. OP01-016_p9, Block X nello ST-31) e per Bandai una ristampa con un
-- Block nuovo vale anche per le stampe vecchie: cards.block diventa il più recente tra le
-- Printing (lo calcola il Catalog Sync), printings.block quello della singola stampa.
-- Null finché il prossimo Catalog Sync non la valorizza.

alter table public.printings
  add column block text check (block ~ '^([0-9]+|X)$');

comment on column public.printings.block is
  'Block stampato su questa Printing: un numero oppure "X"; null se il sito mostra "-".';
comment on column public.cards.block is
  'Block più recente tra le Printing della Card (RIB-76): decide la legalità in Standard.';
