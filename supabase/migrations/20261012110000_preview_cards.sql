-- Anteprime dei Set non ancora usciti (ADR-0016): Set, Card e Printing prese da OPTCG Leaks
-- finché la Official Card List non le pubblica; poi il Catalog Sync le sostituisce con i dati
-- ufficiali. Un'anteprima si vede nel catalogo e si può mettere in un mazzo, ma non in una
-- Collection: nessuno possiede una carta non ancora uscita.

alter table public.sets add column preview boolean not null default false;
alter table public.cards add column preview boolean not null default false;
alter table public.printings add column preview boolean not null default false;
-- Chi ha tradotto il testo della carta (dal sito di origine), da citare nel dettaglio.
alter table public.cards add column preview_credit text;
-- Immagine sul sito di origine: se cambia (il sito pubblica una versione migliore) si riscarica.
alter table public.printings add column preview_image text;

comment on column public.sets.preview is
  'Set in anteprima (ADR-0016): non ancora nella Official Card List; series_id negativo.';
comment on column public.cards.preview is
  'Card in anteprima (ADR-0016): dati e traduzione non ufficiali, sostituiti all''uscita.';
comment on column public.printings.preview is
  'Printing in anteprima (ADR-0016): immagine in card-images/preview/, mai in una Collection.';

-- Una Printing in anteprima non entra in una Collection, qualunque sia la strada (cambia_copie,
-- aggiungi_copie o scrittura diretta): il controllo sta nel database.
create function public.collection_entries_no_preview()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.printings p where p.print_id = new.print_id and p.preview
  ) then
    raise exception 'Carta in anteprima: non si può aggiungere alla Collection'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger collection_entries_no_preview
  before insert or update of print_id on public.collection_entries
  for each row execute function public.collection_entries_no_preview();

alter table public.job_runs drop constraint job_runs_job_check;
alter table public.job_runs
  add constraint job_runs_job_check
  check (job in (
    'catalog_sync', 'image_sync', 'faq_sync', 'explanation_sync', 'price_sync', 'cardtrader_sync',
    'recipe_sync', 'preview_sync'
  ));
