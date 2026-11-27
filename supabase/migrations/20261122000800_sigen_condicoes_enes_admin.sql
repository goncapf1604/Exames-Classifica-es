-- Condições de emissão da Ficha ENES: só o Administrador central as pode alterar (todos os perfis da escola podem ler).
create policy registos_condicoes_enes_inserir on registos as restrictive for insert to authenticated
  with check (colecao <> 'condicoesEnes' or private.perfil() = 'ADMIN_CENTRAL');
create policy registos_condicoes_enes_atualizar on registos as restrictive for update to authenticated
  using (colecao <> 'condicoesEnes' or private.perfil() = 'ADMIN_CENTRAL')
  with check (colecao <> 'condicoesEnes' or private.perfil() = 'ADMIN_CENTRAL');
create policy registos_condicoes_enes_apagar on registos as restrictive for delete to authenticated
  using (colecao <> 'condicoesEnes' or private.perfil() = 'ADMIN_CENTRAL');
