/**
 * Ligação à base de dados partilhada SIGEN (Supabase, projeto "sigen-exames").
 * Mesmo projeto nas duas apps. Pode ser substituído por variáveis de ambiente:
 *   VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 *   VITE_SIGEN_SYNC=off  -> desliga a sincronização (apenas localStorage)
 *
 * A chave "publishable" é pública por natureza (vai sempre para o browser);
 * a proteção dos dados é feita pelas políticas RLS na base de dados.
 */
const env = (import.meta as any).env ?? {};

export const SIGEN_SUPABASE_URL: string = env.VITE_SUPABASE_URL || 'https://wwfqrwfyucmetxkrkhmm.supabase.co';
export const SIGEN_SUPABASE_KEY: string = env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_PgO_GuiEOWkj_sOCRFmrrg_3D9JAqUu';
export const SIGEN_SYNC_ENABLED: boolean = env.VITE_SIGEN_SYNC !== 'off' && !!SIGEN_SUPABASE_URL && !!SIGEN_SUPABASE_KEY;
