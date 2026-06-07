import { createClient } from '@supabase/supabase-js';

// Get environment variables loaded by Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if credentials are real or placeholders
const hasValidConfig = 
  !!supabaseUrl && 
  supabaseUrl !== 'https://your-supabase-project.supabase.co' &&
  !!supabaseAnonKey &&
  supabaseAnonKey !== 'your-supabase-anon-key';

let supabase: ReturnType<typeof createClient> | null = null;

if (hasValidConfig) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
  }
}

export { supabase, hasValidConfig };
