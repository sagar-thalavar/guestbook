import { supabase } from '../db/supabaseClient';

/**
 * Sign in using Google OAuth.
 * Redirects user back to the /guestbook/ subpath.
 */
async function signInWithGoogle() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/guestbook/`
    }
  });

  if (error) throw error;
}

/**
 * Sign in using Email OTP Magic Link.
 * Sends an email containing a secure login link.
 */
async function signInWithMagicLink(email: string) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/guestbook/`
    }
  });

  if (error) throw error;
  return data;
}

/**
 * Sign out the current authenticated user session.
 */
async function signOut() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get details of the currently authenticated user session.
 */
async function getCurrentUser() {
  if (!supabase) return null;
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) return null;
    return user;
  } catch {
    return null;
  }
}

/**
 * Subscribe to authentication state shifts (sign in, token refresh, sign out).
 */
function onAuthChange(callback: (event: string, session: any) => void) {
  if (!supabase) return null;
  
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  
  return subscription;
}

export {
  signInWithGoogle,
  signInWithMagicLink,
  signOut,
  getCurrentUser,
  onAuthChange
};
