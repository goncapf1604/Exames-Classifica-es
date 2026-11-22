/** Cliente Supabase único da app (sessão de login guardada no browser). */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SIGEN_SUPABASE_KEY, SIGEN_SUPABASE_URL, SIGEN_SYNC_ENABLED } from './config';

export const sigenDb: SupabaseClient | null = SIGEN_SYNC_ENABLED
  ? createClient(SIGEN_SUPABASE_URL, SIGEN_SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'sigen-auth' },
    })
  : null;
