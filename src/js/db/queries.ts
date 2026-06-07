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

export {
  fetchUserEntries,
  getSignedSelfieUrl,
  createGuestbookEntry,
  checkUserSubmissionLimits,
  isCurrentUserAdmin,
  fetchAdminEntries,
  moderateGuestbookEntry,
  deleteGuestbookEntry,
  fetchAuditLogs
};
