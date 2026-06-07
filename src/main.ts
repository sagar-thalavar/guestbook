import { createClient } from '@supabase/supabase-js';

// Get environment variables loaded by Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if credentials are real or placeholders
const hasValidConfig = 
  supabaseUrl && 
  supabaseUrl !== 'https://your-supabase-project.supabase.co' &&
  supabaseAnonKey &&
  supabaseAnonKey !== 'your-supabase-anon-key';

let supabase: ReturnType<typeof createClient> | null = null;

// Initialize Supabase client if configuration is provided
if (hasValidConfig) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
  }
}

// DOM Setup
document.addEventListener('DOMContentLoaded', () => {
  const statusIndicator = document.getElementById('auth-status-indicator');
  const btnLoginRedirect = document.getElementById('btn-login-redirect');

  if (statusIndicator) {
    if (hasValidConfig) {
      statusIndicator.textContent = 'Supabase Connected';
      statusIndicator.classList.add('connected');
    } else {
      statusIndicator.textContent = 'Configure Supabase (.env)';
      statusIndicator.style.borderColor = 'var(--danger)';
    }
  }

  if (btnLoginRedirect) {
    btnLoginRedirect.addEventListener('click', () => {
      if (!hasValidConfig) {
        alert(
          'Please set up your Supabase project URL and anon key in the `.env` file first, then run `npm run dev` to reload configuration.'
        );
      } else {
        alert('Supabase is configured! Ready for Phase 1 Authentication integration.');
      }
    });
  }

  // Visual log for validation
  console.log('Guestbook Foundation: Initialized successfully.');
  console.log('Config status:', {
    hasValidConfig,
    url: supabaseUrl,
    key: supabaseAnonKey ? '***' : null
  });
});

export { supabase, hasValidConfig };
