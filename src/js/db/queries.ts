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

export {
  fetchUserEntries,
  getSignedSelfieUrl
};
