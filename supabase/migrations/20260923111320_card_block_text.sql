-- Il Block stampato sulla carta non è sempre un numero: alcune carte riportano "X"
-- (es. OP16-063). Diventa testo: un numero oppure "X"; null se il sito mostra "-".

alter table public.cards drop constraint cards_block_check;

alter table public.cards alter column block type text using block::text;

alter table public.cards add constraint cards_block_check check (block ~ '^([0-9]+|X)$');
