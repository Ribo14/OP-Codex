-- Panoramica Admin: contenuti da completare (RIB-93). Le carte nuove arrivano da sole col
-- Catalog Sync e col Preview Sync, ma spiegazioni e FAQ si scrivono in sessione (ADR-0006):
-- qui si vede quando ne serve una.

-- Carte con effetto senza spiegazione (ufficiali e anteprime), per Set (prefisso del Card
-- Code, es. "OP19"), e i Set booster ufficiali senza nessuna FAQ.
create function private.contenuti_mancanti()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with senza as (
    select c.card_code, c.preview, split_part(c.card_code, '-', 1) as prefisso
    from public.cards c
    where coalesce(c.effect, '') <> ''
      and not exists (
        select 1 from public.card_explanations e
        where e.card_code = c.card_code and e.body <> ''
      )
  ),
  booster as (
    select s.code, replace(s.code, '-', '') as prefisso
    from public.sets s
    where not s.preview and s.code ~ '^(OP|EB)-[0-9]+$'
  )
  select jsonb_build_object(
    'missing_explanations', (select count(*) from senza where not preview),
    'missing_explanations_preview', (select count(*) from senza where preview),
    'missing_by_set', coalesce(
      (
        select jsonb_agg(jsonb_build_object('set', prefisso, 'count', n, 'preview', anteprima)
                         order by n desc, prefisso)
        from (
          select prefisso, count(*) as n, bool_or(preview) as anteprima
          from senza group by prefisso
        ) per_set
      ),
      '[]'::jsonb
    ),
    'sets_without_faq', coalesce(
      (
        select jsonb_agg(b.code order by b.code)
        from booster b
        where exists (select 1 from public.cards c where c.card_code like b.prefisso || '-%')
          and not exists (
            select 1 from public.card_faqs f
            where f.card_code like b.prefisso || '-%' and jsonb_array_length(f.items) > 0
          )
      ),
      '[]'::jsonb
    )
  )
$$;

revoke all on function private.contenuti_mancanti() from public, anon, authenticated;
grant execute on function private.contenuti_mancanti() to authenticated;

-- Stessa panoramica di prima, con in più i contenuti da completare.
create or replace function public.admin_panoramica()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.richiedi_admin();
  return jsonb_build_object(
    'users', (select count(*) from auth.users),
    'users_new_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'users_active_7d',
      (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'users_suspended', (select count(*) from auth.users where banned_until > now()),
    'decks', (select count(*) from public.decks),
    'collection_copies', (select coalesce(sum(quantity), 0) from public.collection_entries),
    'open_reports',
      (select count(*) from public.explanation_reports where status in ('open', 'in_progress')),
    'content', private.contenuti_mancanti(),
    'jobs', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'job', ultimo.job,
            'status', ultimo.status,
            'started_at', ultimo.started_at,
            'finished_at', ultimo.finished_at,
            'error', ultimo.error,
            'last_success_at', (
              select max(r.finished_at)
              from public.job_runs r
              where r.job = ultimo.job and r.status = 'success'
            )
          )
          order by ultimo.job
        )
        from (
          select distinct on (job) job, status, started_at, finished_at, error
          from public.job_runs
          order by job, started_at desc
        ) ultimo
      ),
      '[]'::jsonb
    )
  );
end;
$$;
