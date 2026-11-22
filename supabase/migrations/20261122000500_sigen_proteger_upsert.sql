-- O "upsert" das apps passa sempre pelo gatilho BEFORE INSERT (mesmo quando acaba em UPDATE).
-- A inserção por não administradores já é recusada pela política RLS; aqui só se valida o UPDATE.
create or replace function private.proteger_utilizador()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    if private.perfil() = 'ADMIN_AGRUPAMENTO' and new.perfil = 'ADMIN_CENTRAL'
       and not exists (select 1 from utilizadores u where u.id = new.id and u.perfil = 'ADMIN_CENTRAL') then
      raise exception 'Só o Administrador central pode atribuir esse perfil' using errcode = '42501';
    end if;
    return new;
  end if;
  if not private.e_admin() then
    if (new.nome, new.email, new.perfil, new.escola_ids, new.vigencia_inicio, new.vigencia_fim,
        new.mfa_ativo, new.estado, new.aluno_refs, new.auth_user_id)
       is distinct from
       (old.nome, old.email, old.perfil, old.escola_ids, old.vigencia_inicio, old.vigencia_fim,
        old.mfa_ativo, old.estado, old.aluno_refs, old.auth_user_id) then
      raise exception 'Sem permissão para alterar dados da conta' using errcode = '42501';
    end if;
  elsif private.perfil() = 'ADMIN_AGRUPAMENTO' and new.perfil = 'ADMIN_CENTRAL' and old.perfil <> 'ADMIN_CENTRAL' then
    raise exception 'Só o Administrador central pode atribuir esse perfil' using errcode = '42501';
  end if;
  return new;
end;
$$;
