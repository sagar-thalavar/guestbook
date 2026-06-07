import { hasValidConfig } from './js/db/supabaseClient';
import { 
  onAuthChange, 
  signOut, 
  signInWithGoogle, 
  signInWithMagicLink 
} from './js/auth/auth';
import { createGuestbookEntry } from './js/db/queries';
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

// Track current user session state
let currentUser: any = null;

// Track selected mood inside the form
let selectedMood: string | null = null;

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

  // 3. Login Email Form Submissions
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

  // 5. Dashboard Navigation triggers
  const btnCreateEntryTrigger = document.getElementById('btn-create-entry-trigger');
  const btnCancelEntry = document.getElementById('btn-cancel-entry');

  if (btnCreateEntryTrigger) {
    btnCreateEntryTrigger.addEventListener('click', () => {
      showView('create-entry');
    });
  }

  if (btnCancelEntry) {
    btnCancelEntry.addEventListener('click', () => {
      showView('dashboard', currentUser);
    });
  }

  // 6. Character limits & Counter listener
  const entryMessageInput = document.getElementById('input-entry-message') as HTMLTextAreaElement;
  const charCounter = document.getElementById('char-counter');

  if (entryMessageInput && charCounter) {
    entryMessageInput.addEventListener('input', () => {
      const len = entryMessageInput.value.length;
      charCounter.textContent = `${len} / 200`;

      // Set counter visual cues
      if (len >= 180 && len < 200) {
        charCounter.className = 'char-counter-text warning';
      } else if (len >= 200) {
        charCounter.className = 'char-counter-text danger';
      } else {
        charCounter.className = 'char-counter-text';
      }
    });
  }

  // 7. Mood selection pills logic
  const moodPills = document.querySelectorAll('#mood-pills-wrapper .mood-pill');
  const customMoodInput = document.getElementById('input-entry-custom-mood') as HTMLInputElement;

  moodPills.forEach(pill => {
    pill.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      
      // Remove active from all
      moodPills.forEach(p => p.classList.remove('active'));
      
      // Add active to current
      target.classList.add('active');

      const moodVal = target.getAttribute('data-mood');
      if (moodVal === 'custom') {
        selectedMood = 'custom';
        if (customMoodInput) {
          customMoodInput.style.display = 'block';
          customMoodInput.value = '';
          customMoodInput.focus();
        }
      } else {
        selectedMood = moodVal;
        if (customMoodInput) {
          customMoodInput.style.display = 'none';
          customMoodInput.value = '';
        }
      }
    });
  });

  // 8. Consent verification validation (enabling submit button)
  const consentModeration = document.getElementById('checkbox-consent-moderation') as HTMLInputElement;
  const consentStorage = document.getElementById('checkbox-consent-storage') as HTMLInputElement;
  const btnSubmitEntry = document.getElementById('btn-submit-entry') as HTMLButtonElement;

  function validateConsentState() {
    if (btnSubmitEntry && consentModeration && consentStorage) {
      btnSubmitEntry.disabled = !(consentModeration.checked && consentStorage.checked);
    }
  }

  if (consentModeration) {
    consentModeration.addEventListener('change', validateConsentState);
  }
  if (consentStorage) {
    consentStorage.addEventListener('change', validateConsentState);
  }

  // 9. Entry Form Submittal handler
  const formCreateEntry = document.getElementById('form-create-entry') as HTMLFormElement;
  if (formCreateEntry) {
    formCreateEntry.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const nameInput = document.getElementById('input-entry-name') as HTMLInputElement;
      const name = nameInput ? nameInput.value.trim() : '';
      const message = entryMessageInput ? entryMessageInput.value.trim() : '';

      // Determine final mood value
      let finalMood: string | null = null;
      if (selectedMood === 'custom' && customMoodInput) {
        finalMood = customMoodInput.value.trim() || null;
      } else {
        finalMood = selectedMood;
      }

      if (!name) {
        alert('Please enter your name.');
        return;
      }

      try {
        if (btnSubmitEntry) {
          btnSubmitEntry.disabled = true;
          btnSubmitEntry.textContent = 'Submitting...';
        }

        await createGuestbookEntry(name, message, finalMood, true);
        alert('Your entry was successfully submitted and is pending review!');
        
        // Return to dashboard
        showView('dashboard', currentUser);
      } catch (err: any) {
        console.error('Failed to create guestbook entry:', err);
        alert(`Failed to save entry: ${err.message || 'Unknown database error'}`);
      } finally {
        if (btnSubmitEntry) {
          btnSubmitEntry.textContent = 'Submit Entry';
          validateConsentState();
        }
      }
    });
  }

  // 10. Subscribe to Supabase Auth State Shifts
  if (hasValidConfig) {
    onAuthChange((event, session) => {
      console.log(`Auth state change triggered: ${event}`);
      currentUser = session?.user || null;
      
      if (currentUser) {
        updateNavigation(currentUser);
        showView('dashboard', currentUser);
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
