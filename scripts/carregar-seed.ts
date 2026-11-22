/**
 * Carrega os dados de exemplo desta app na base de dados partilhada (Supabase)
 * e cria as contas de acesso em falta, sem substituir registos que já existam.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... npm run db:seed
 *
 * A chave de serviço (Supabase > Project Settings > API) ignora as regras de acesso:
 * use-a só no seu computador, nunca na app nem no repositório.
 * Ordem recomendada: primeiro SIGEN Exames, depois SIGEN Classificações.
 * Contas novas ficam com a palavra-passe temporária SIGEN_PASSWORD_INICIAL
 * (por omissão "Sigen2026!") e troca obrigatória no 1.º acesso.
 */
import { createClient } from '@supabase/supabase-js';
import { INITIAL_SIGEN_STATE as seed } from '../src/data/seedData';
import { CLASSIFICACOES_BINDINGS as BINDINGS } from '../src/sync/bindings';
import { SIGEN_SUPABASE_URL } from '../src/sync/config';

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) {
  console.error('Defina SUPABASE_SERVICE_ROLE_KEY (Supabase > Project Settings > API > service_role).');
  process.exit(1);
}
const db = createClient(process.env.VITE_SUPABASE_URL || SIGEN_SUPABASE_URL, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const state = (typeof seed === 'function' ? (seed as () => unknown)() : seed) as Record<string, any>;

for (const b of BINDINGS) {
  const rows = ((state[b.key] as any[]) ?? []).map((i) => b.toRow(i));
  if (!rows.length) continue;
  const { error } = await db.from(b.table).upsert(rows, { onConflict: b.onConflict ?? 'id', ignoreDuplicates: true });
  console.log(`${error ? '✗' : '✓'} ${b.table}/${b.key}: ${rows.length}${error ? ` — ${error.message}` : ''}`);
  if (error) process.exitCode = 1;
}

// Contas de acesso (Supabase Auth) para utilizadores ainda sem conta
const { data: semConta } = await db.from('utilizadores').select('email').is('auth_user_id', null);
for (const u of semConta ?? []) {
  const { error } = await db.auth.admin.createUser({
    email: u.email,
    password: process.env.SIGEN_PASSWORD_INICIAL || 'Sigen2026!',
    email_confirm: true,
    app_metadata: { trocar_password: true },
  });
  console.log(`${error ? '✗' : '✓'} conta ${u.email}${error ? ` — ${error.message}` : ''}`);
}
