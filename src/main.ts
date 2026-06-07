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

// Theme management helpers
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // Set theme. Default to dark if no setting exists
  const theme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
  setTheme(theme);
}

function setTheme(theme: string) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  updateThemeIcons(theme);
}

function updateThemeIcons(theme: string) {
  const sunIcon = document.querySelector('.theme-icon-sun') as HTMLElement;
  const moonIcon = document.querySelector('.theme-icon-moon') as HTMLElement;
  
  if (sunIcon && moonIcon) {
    if (theme === 'dark') {
      sunIcon.style.display = 'block';
      moonIcon.style.display = 'none';
    } else {
      sunIcon.style.display = 'none';
      moonIcon.style.display = 'block';
    }
  }
}

// DOM Setup
document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Theme
  initTheme();
  
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      setTheme(newTheme);
    });
  }

  // 2. Setup Supabase Connections & Status Checks
  const statusIndicator = document.getElementById('auth-status-indicator');
  const btnLoginRedirect = document.getElementById('btn-login-redirect');

  if (statusIndicator) {
    if (hasValidConfig) {
      statusIndicator.textContent = 'Connected';
      statusIndicator.classList.add('connected');
    } else {
      statusIndicator.textContent = 'Configure Database';
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
  console.log('Guestbook Foundation: Initialized successfully with Portfolio theme.');
});

export { supabase, hasValidConfig };
