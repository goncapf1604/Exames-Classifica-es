-- O upsert das apps verifica a política de INSERT mesmo quando acaba em UPDATE.
-- auth_user_id é preenchido pelo gatilho a partir do email; só passa a própria linha
-- (e auth_user_id é único, por isso não é possível criar uma segunda linha para a mesma conta).
create policy utilizadores_proprio_upsert on utilizadores for insert to authenticated
  with check (private.ativo() and auth_user_id = auth.uid());
