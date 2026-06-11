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
 * Upload a selfie image blob to the private 'selfies' Supabase Storage bucket.
 * Folder structure: [userId]/[entryId]_[timestamp].jpg
 */
async function uploadSelfie(blob: Blob, entryId: string, userId: string): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const timestamp = Date.now();
  const filePath = `${userId}/${entryId}_${timestamp}.jpg`;

  const { error } = await supabase.storage
    .from('selfies')
    .upload(filePath, blob, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    console.error('Error uploading selfie to storage:', error);
    throw error;
  }

  return filePath;
}

/**
 * Create a new guestbook entry in the database.
 * If a selfie Blob is provided, it is uploaded to storage, and the row is updated.
 */
async function createGuestbookEntry(
  name: string, 
  message: string, 
  mood: string | null, 
  consentGiven: boolean,
  isPublic: boolean,
  selfieBlob: Blob | null = null
) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  // Retrieve current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('User session not found. Please sign in again.');
  }

  // 1. Insert database record (initially without selfie_url)
  const { data, error } = await (supabase
    .from('guestbook_entries') as any)
    .insert([
      {
        user_id: user.id,
        original_name: name,
        message,
        mood,
        consent_given: consentGiven,
        is_public: isPublic,
        status: 'pending' // always created as pending review
      }
    ])
    .select();

  if (error) {
    console.error('Error creating guestbook entry:', error);
    throw error;
  }

  const newEntry = (data ? data[0] : null) as any;
  if (!newEntry) {
    throw new Error('Failed to create guestbook entry record.');
  }

  // 2. If a selfie was captured, upload to storage and update the database row
  if (selfieBlob) {
    try {
      const filePath = await uploadSelfie(selfieBlob, newEntry.id, user.id);
      
      const { data: updatedData, error: updateError } = await (supabase
        .from('guestbook_entries') as any)
        .update({ selfie_url: filePath })
        .eq('id', newEntry.id)
        .select();

      if (updateError) throw updateError;
      return updatedData ? updatedData[0] : newEntry;
    } catch (uploadError) {
      console.error('Failed to upload selfie, database record left with null photo:', uploadError);
      return newEntry;
    }
  }

  return newEntry;
}

/**
 * Checks the number of submissions the user has made over rolling daily interval.
 * Limits: 10/day.
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

  // Run only daily count query to optimize database overhead
  const dailyRes = await supabase
    .from('guestbook_entries')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', dailyThreshold);

  if (dailyRes.error) throw dailyRes.error;

  return {
    dailyCount: dailyRes.count || 0,
    weeklyCount: 0,
    monthlyCount: 0,
    lifetimeCount: 0
  };
}

/**
 * Checks if the currently logged-in user has the 'admin' role.
 */
async function isCurrentUserAdmin(): Promise<boolean> {
  if (!supabase) return false;
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return false;
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single() as any;
      
    if (error || !data) return false;
    return data.role === 'admin';
  } catch (err) {
    console.error('Error in isCurrentUserAdmin:', err);
    return false;
  }
}

/**
 * Fetch all entries in the guestbook (admin only).
 */
async function fetchAdminEntries() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabase
    .from('guestbook_entries')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching admin entries:', error);
    throw error;
  }

  return data;
}

/**
 * Moderates a guestbook entry (approves or rejects).
 */
async function moderateGuestbookEntry(
  entryId: string,
  status: 'approved' | 'rejected',
  rejectionReason: string | null = null,
  customRejectionReason: string | null = null
) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await (supabase
    .from('guestbook_entries') as any)
    .update({
      status,
      rejection_reason: rejectionReason,
      custom_rejection_reason: customRejectionReason
    })
    .eq('id', entryId)
    .select();

  if (error) {
    console.error('Error moderating entry:', error);
    throw error;
  }

  return data ? data[0] : null;
}

/**
 * Deletes a guestbook entry (admin only or owner during account purge).
 */
async function deleteGuestbookEntry(entryId: string) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const { error } = await supabase
    .from('guestbook_entries')
    .delete()
    .eq('id', entryId);

  if (error) {
    console.error('Error deleting entry:', error);
    throw error;
  }
}

/**
 * Fetch all audit logs (admin only).
 */
async function fetchAuditLogs() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching audit logs:', error);
    throw error;
  }

  return data;
}

/**
 * Replaces or updates an existing guestbook entry (used during re-uploads for rejected entries).
 * Increments the reupload_attempts counter and resets status to 'pending'.
 */
async function replaceGuestbookEntry(
  entryId: string,
  name: string,
  message: string,
  mood: string | null,
  isPublic: boolean,
  selfieBlob: Blob | null = null
) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  // 1. Fetch current entry to get current reupload_attempts count and status
  const { data: currentEntry, error: fetchError } = await (supabase
    .from('guestbook_entries') as any)
    .select('reupload_attempts, status')
    .eq('id', entryId)
    .single();

  if (fetchError || !currentEntry) {
    throw new Error('Failed to retrieve entry details for replacement/editing.');
  }

  if (currentEntry.status === 'approved') {
    throw new Error('Approved entries are locked and cannot be edited.');
  }

  let nextAttempts = currentEntry.reupload_attempts || 0;
  if (currentEntry.status === 'rejected') {
    nextAttempts = nextAttempts + 1;
    if (nextAttempts > 3) {
      throw new Error('Maximum replacement attempts exceeded (max 3).');
    }
  }

  // 2. Retrieve user details for path construction
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Session expired. Please sign in again.');

  let filePath = null;
  if (selfieBlob) {
    filePath = await uploadSelfie(selfieBlob, entryId, user.id);
  }

  // 3. Update database record
  const updateData: any = {
    original_name: name,
    message,
    mood,
    status: 'pending', // always reset status to pending review
    is_public: isPublic,
    reupload_attempts: nextAttempts
  };

  if (filePath) {
    updateData.selfie_url = filePath;
  }

  const { data, error } = await (supabase
    .from('guestbook_entries') as any)
    .update(updateData)
    .eq('id', entryId)
    .select();

  if (error) {
    console.error('Error replacing entry:', error);
    throw error;
  }

  return data ? data[0] : null;
}

/**
 * Permanently deletes the logged-in user's account, including all their entry rows,
 * profile, and uploaded selfies from storage.
 */
async function deleteUserAccount() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  // 1. Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('User session not found.');
  }

  // 2. Fetch all user entries to find their selfies
  const { data: entries, error: entriesError } = await (supabase
    .from('guestbook_entries') as any)
    .select('selfie_url')
    .eq('user_id', user.id);

  if (entriesError) {
    console.error('Error fetching user entries for deletion:', entriesError);
  }

  // 3. Delete selfies from storage
  if (entries && entries.length > 0) {
    const filePaths = entries
      .map((e: any) => e.selfie_url)
      .filter((url: any): url is string => !!url);

    if (filePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('selfies')
        .remove(filePaths);

      if (storageError) {
        console.error('Error deleting user selfies from storage:', storageError);
        // We continue anyway, because deleting the account database records is critical
      }
    }
  }

  // 4. Call delete_own_user_account RPC
  const { error: rpcError } = await supabase.rpc('delete_own_user_account');
  if (rpcError) {
    console.error('Error calling delete_own_user_account RPC:', rpcError);
    throw rpcError;
  }

  // 5. Sign out to clear session
  await supabase.auth.signOut();
}

export {
  fetchUserEntries,
  getSignedSelfieUrl,
  createGuestbookEntry,
  checkUserSubmissionLimits,
  isCurrentUserAdmin,
  fetchAdminEntries,
  moderateGuestbookEntry,
  deleteGuestbookEntry,
  fetchAuditLogs,
  replaceGuestbookEntry,
  deleteUserAccount
};
