import { supabase } from './supabase';

// The planner's full PersistedState gets stored verbatim as a JSON blob. This
// module knows nothing about its shape — it just round-trips the value so the
// PlannerContext stays in charge of schema.

const TABLE = 'user_state';

/**
 * Fetch the user's cloud state. Returns `null` when no row exists yet (this
 * is normal on first login). Throws for actual database errors.
 */
export async function fetchCloudState(userId: string): Promise<unknown | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('state')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.state ?? null;
}

/**
 * Upsert the user's state. Caller is responsible for debouncing — every call
 * is a network write.
 */
export async function pushCloudState(
  userId: string,
  state: unknown,
): Promise<void> {
  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: userId,
      state,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}
