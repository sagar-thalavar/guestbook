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

export {
  fetchUserEntries,
  getSignedSelfieUrl,
  createGuestbookEntry
};
