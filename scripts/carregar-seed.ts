/**
 * Carrega os dados de exemplo desta app na base de dados partilhada (Supabase),
 * sem substituir registos que já existam.
 *   npx tsx scripts/carregar-seed.ts
 * Ordem recomendada: primeiro SIGEN Exames, depois SIGEN Classificações.
 */
import { createClient } from '@supabase/supabase-js';
import { INITIAL_SIGEN_STATE } from '../src/data/seedData';
import { CLASSIFICACOES_BINDINGS as BINDINGS } from '../src/sync/bindings';
import { SIGEN_SUPABASE_KEY, SIGEN_SUPABASE_URL } from '../src/sync/config';

const state: Record<string, any> = INITIAL_SIGEN_STATE;
const db = createClient(process.env.VITE_SUPABASE_URL || SIGEN_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || SIGEN_SUPABASE_KEY);

for (const b of BINDINGS) {
  const rows = ((state[b.key] as any[]) ?? []).map((i) => b.toRow(i));
  if (!rows.length) continue;
  const { error } = await db.from(b.table).upsert(rows, { onConflict: b.onConflict ?? 'id', ignoreDuplicates: true });
  console.log(`${error ? '✗' : '✓'} ${b.table}/${b.key}: ${rows.length}${error ? ` — ${error.message}` : ''}`);
  if (error) process.exitCode = 1;
}
