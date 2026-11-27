-- EE / aluno maior: calendários e publicações só depois de publicados
create or replace function private.registo_visivel_ee(p_app sigen_app, p_colecao text, d jsonb)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_colecao = 'calendars' then coalesce(d->>'estado', '') <> 'Rascunho'
    when p_app = 'classificacoes' and p_colecao = 'publications' then d->>'estado' = 'Publicada'
    when p_app = 'classificacoes' and p_colecao = 'results' then d->>'estado' = 'Publicado' and private.registo_do_ee(d)
    when (p_app = 'exames' and p_colecao in ('enrollments', 'enesRequests', 'guardians'))
      or (p_app = 'classificacoes' and p_colecao in ('consultations', 'availabilities', 'scoreRectifications',
                                                      'reappraisals', 'jneComplaints'))
      then private.registo_do_ee(d)
    else false
  end
$$;
