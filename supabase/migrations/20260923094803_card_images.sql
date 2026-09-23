-- Immagini delle Printing copiate in WebP su Supabase Storage (ADR-0005).
-- Per ogni Printing: thumb/{PrintID}.webp (griglia) e full/{PrintID}.webp (dettaglio).

-- Bucket pubblico: gli oggetti si leggono dall'URL pubblico senza bisogno di policy.
-- Solo WebP e al massimo 1 MB per file.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-images', 'card-images', true, 1048576, array['image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Nessuna policy su storage.objects per questo bucket: anon e authenticated non possono
-- elencare, caricare, modificare o cancellare. Scrive solo l'Image Sync con la chiave segreta.

-- Stato dell'Image Sync: quando sono state caricate le immagini della Printing.
alter table public.printings add column image_synced_at timestamptz;

comment on column public.printings.image_synced_at is
  'Quando l''Image Sync ha caricato thumb e full su Storage; null = da scaricare.';

create index printings_image_pending_idx on public.printings (print_id)
  where image_synced_at is null;
