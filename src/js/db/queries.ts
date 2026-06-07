import { supabase } from './supabaseClient';

/**
 * Fetch all guestbook entries belonging to the currently logged-in user.
 * Sorting: Newest first.
 */
async function fetchUserEntries() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabase
    .from('guestbook_entries')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching user entries:', error);
    throw error;
  }

  return data;
}

/**
 * Generate a secure, short-lived (60-second) signed URL to display private selfies.
 */
async function getSignedSelfieUrl(filePath: string) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabase.storage
    .from('selfies')
    .createSignedUrl(filePath, 60);

  if (error) {
    console.error('Error creating signed URL:', error);
    return null;
  }

  return data.signedUrl;
}

/**
 * Create a new guestbook entry in the database.
 */
async function createGuestbookEntry(name: string, message: string, mood: string | null, consentGiven: boolean) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  // Retrieve current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('User session not found. Please sign in again.');
  }

  const { data, error } = await supabase
    .from('guestbook_entries')
    .insert([
      {
        user_id: user.id,
        original_name: name,
        message,
        mood,
        consent_given: consentGiven,
        status: 'pending' // always created as pending review
      }
    ] as any)
    .select();

  if (error) {
    console.error('Error creating guestbook entry:', error);
    throw error;
  }

  return data ? data[0] : null;
}

/**
 * Checks the number of submissions the user has made over rolling and calendar intervals.
 * Limits: 1/day, 3/week, 10/month, 50/lifetime approved.
 * Bypasses checks if user has 'admin' role (allowing unlimited testing).
 */
async function checkUserSubmissionLimits() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  // Get current user UUID
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('User session not found.');
  }

  // 1. Fetch user role to check for admin/developer bypass
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as any;

  if (profileError) {
    console.error('Error fetching user profile role:', profileError);
  }

  // If user is an admin, return 0 counts to bypass all rate limit checks
  if (profile && profile.role === 'admin') {
    return {
      dailyCount: 0,
      weeklyCount: 0,
      monthlyCount: 0,
      lifetimeCount: 0
    };
  }

  const now = new Date();
  
  // Daily: rolling 24 hours
  const dailyThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  
  // Weekly: rolling 7 days
  const weeklyThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  // Monthly: current calendar month start
  const monthlyThreshold = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Run all count queries concurrently
  const [dailyRes, weeklyRes, monthlyRes, lifetimeRes] = await Promise.all([
    supabase
      .from('guestbook_entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', dailyThreshold),
    supabase
      .from('guestbook_entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', weeklyThreshold),
    supabase
      .from('guestbook_entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', monthlyThreshold),
    supabase
      .from('guestbook_entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'approved')
  ]);

  if (dailyRes.error) throw dailyRes.error;
  if (weeklyRes.error) throw weeklyRes.error;
  if (monthlyRes.error) throw monthlyRes.error;
  if (lifetimeRes.error) throw lifetimeRes.error;

  return {
    dailyCount: dailyRes.count || 0,
    weeklyCount: weeklyRes.count || 0,
    monthlyCount: monthlyRes.count || 0,
    lifetimeCount: lifetimeRes.count || 0
  };
}

export {
  fetchUserEntries,
  getSignedSelfieUrl,
  createGuestbookEntry,
  checkUserSubmissionLimits
};
