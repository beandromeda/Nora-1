import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  // Better to fail loud than silently route every write into the void.
  // .env.local in dev, Vercel env vars in prod.
  throw new Error(
    'Supabase env vars missing — set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
  );
}

export const supabase = createClient(url, key, {
  auth: {
    // Keep the user signed in across browser restarts.
    persistSession: true,
    autoRefreshToken: true,
    // Magic-link callbacks land back on this origin.
    detectSessionInUrl: true,
  },
});
