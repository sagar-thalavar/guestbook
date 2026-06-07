import { hasValidConfig } from './js/db/supabaseClient';
import { 
  onAuthChange, 
  signOut, 
  signInWithGoogle, 
  signInWithMagicLink 
} from './js/auth/auth';
import { showView, updateNavigation } from './js/ui';

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
  // 1. Initialize Theme Switcher
  initTheme();
  
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      setTheme(newTheme);
    });
  }

  // 2. Auth Page Navigation Trigger Buttons
  const btnLoginRedirect = document.getElementById('btn-login-redirect');
  const btnLoginBack = document.getElementById('btn-login-back');
  const btnSignOut = document.getElementById('btn-nav-signout');

  if (btnLoginRedirect) {
    btnLoginRedirect.addEventListener('click', () => {
      if (!hasValidConfig) {
        alert(
          'Please set up your Supabase project URL and anon key in the `.env` file first to configure the database.'
        );
      } else {
        showView('login');
      }
    });
  }

  if (btnLoginBack) {
    btnLoginBack.addEventListener('click', () => {
      showView('welcome');
    });
  }

  if (btnSignOut) {
    btnSignOut.addEventListener('click', async () => {
      try {
        await signOut();
        alert('You have signed out successfully.');
      } catch (err) {
        console.error('Error signing out:', err);
      }
    });
  }

  // 3. Form Submission Helpers
  const formMagicLink = document.getElementById('form-magic-link') as HTMLFormElement;
  const btnMagicLinkSubmit = document.getElementById('btn-magic-link') as HTMLButtonElement;

  if (formMagicLink) {
    formMagicLink.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('input-login-email') as HTMLInputElement;
      const email = emailInput ? emailInput.value.trim() : '';
      
      if (!email) return;

      try {
        if (btnMagicLinkSubmit) {
          btnMagicLinkSubmit.disabled = true;
          btnMagicLinkSubmit.textContent = 'Sending Link...';
        }

        await signInWithMagicLink(email);
        alert(`Magic Link sent successfully! Please check your email inbox at ${email} to complete sign-in.`);
        
        if (emailInput) emailInput.value = '';
      } catch (err: any) {
        console.error('Error sending magic link:', err);
        alert(`Failed to send magic link: ${err.message || 'Unknown error'}`);
      } finally {
        if (btnMagicLinkSubmit) {
          btnMagicLinkSubmit.disabled = false;
          btnMagicLinkSubmit.textContent = 'Send Email Magic Link';
        }
      }
    });
  }

  // 4. Google Login Button Action
  const btnGoogleLogin = document.getElementById('btn-google-login');
  if (btnGoogleLogin) {
    btnGoogleLogin.addEventListener('click', async () => {
      try {
        await signInWithGoogle();
      } catch (err: any) {
        console.error('Error signing in with Google:', err);
        alert(`Failed to sign in with Google: ${err.message || 'Unknown error'}`);
      }
    });
  }

  // 5. Subscribe to Supabase Auth State Shifts
  if (hasValidConfig) {
    onAuthChange((event, session) => {
      console.log(`Auth state change triggered: ${event}`);
      const user = session?.user || null;
      
      if (user) {
        updateNavigation(user);
        showView('dashboard', user);
      } else {
        updateNavigation(null);
        showView('welcome');
      }
    });
  } else {
    // If not configured, render default public view and connection warning
    updateNavigation(null);
    showView('welcome');
  }

  console.log('Guestbook: Main scripts booted and aligned with Portfolio theme.');
});
