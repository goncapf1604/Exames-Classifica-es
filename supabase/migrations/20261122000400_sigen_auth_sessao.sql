-- Estado da sessão do próprio utilizador (usado pelo login das apps e pela função sigen-contas)
create or replace function public.sigen_minha_sessao()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'utilizador_id', u.id,
    'nome', u.nome,
    'email', u.email,
    'perfil', u.perfil,
    'estado', u.estado,
    'mfa_ativo', u.mfa_ativo,
    'dentro_vigencia', (u.vigencia_inicio is null or u.vigencia_inicio <= current_date)
                       and (u.vigencia_fim is null or u.vigencia_fim >= current_date),
    'trocar_password', coalesce(auth.jwt()->'app_metadata'->>'trocar_password', 'false') = 'true',
    'aal', auth.jwt()->>'aal',
    'ativo', private.ativo(),
    'escolas', to_jsonb(private.escolas()))
  from utilizadores u where u.auth_user_id = auth.uid()
$$;
revoke execute on function public.sigen_minha_sessao() from public, anon;
grant execute on function public.sigen_minha_sessao() to authenticated;

-- Mudar o email no C04 muda também o email de login (mantém a ligação à conta)
create or replace function private.ligar_auth_utilizador()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  if tg_op = 'UPDATE' and new.email is distinct from old.email and old.auth_user_id is not null then
    update auth.users set email = new.email, updated_at = now() where id = old.auth_user_id;
    update auth.identities set identity_data = identity_data || jsonb_build_object('email', new.email)
     where user_id = old.auth_user_id and provider = 'email';
    new.auth_user_id := old.auth_user_id;
  elsif new.auth_user_id is null then
    new.auth_user_id := (select id from auth.users where lower(email) = lower(new.email) limit 1);
  end if;
  return new;
end;
$$;
