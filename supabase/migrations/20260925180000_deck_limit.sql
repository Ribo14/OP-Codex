-- Limite di Deck per utente (RIB-35, checklist ASVS V2.2.1): senza, chiamando direttamente l'API
-- si potrebbero creare Deck all'infinito e riempire il database. 200 è molto oltre l'uso reale.
-- Vale per ogni inserimento: nuovo Deck, import di una lista, duplicazione.

create function private.limite_mazzi()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Un inserimento alla volta per utente, così due richieste in parallelo non superano il limite.
  perform pg_advisory_xact_lock(hashtext('decks:' || new.user_id::text));
  if (select count(*) from public.decks where user_id = new.user_id) >= 200 then
    raise exception 'troppi_mazzi' using errcode = '23514',
      detail = 'Ogni utente può avere al massimo 200 mazzi.';
  end if;
  return new;
end;
$$;

revoke all on function private.limite_mazzi() from public, anon, authenticated;

create trigger decks_limite_per_utente
  before insert on public.decks
  for each row execute function private.limite_mazzi();
