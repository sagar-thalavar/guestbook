import { hasValidConfig } from './js/db/supabaseClient';
import { 
  onAuthChange, 
  signOut, 
  signInWithGoogle, 
  signInWithMagicLink 
} from './js/auth/auth';
import { 
  createGuestbookEntry, 
  isCurrentUserAdmin,
  replaceGuestbookEntry,
  deleteUserAccount
} from './js/db/queries';
import { 
  showView, 
  updateNavigation, 
  renderAdminAllTab, 
  exportAdminEntriesToCSV 
} from './js/ui';
import { 
  startWebcam, 
  stopWebcam, 
  captureFrame, 
  processUploadedFile 
} from './js/components/camera';

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

// Track captured/uploaded selfie blob
let activeSelfieBlob: Blob | null = null;

// Reset the camera UI to its initial state
function resetCameraUI() {
  stopWebcam();
  activeSelfieBlob = null;
  
  const video = document.getElementById('camera-video') as HTMLVideoElement;
  const placeholder = document.getElementById('camera-placeholder') as HTMLElement;
  const preview = document.getElementById('camera-preview') as HTMLImageElement;
  const btnStart = document.getElementById('btn-camera-start') as HTMLButtonElement;
  const btnCapture = document.getElementById('btn-camera-capture') as HTMLButtonElement;
  const btnReset = document.getElementById('btn-camera-reset') as HTMLButtonElement;
  const fallbackWrapper = document.getElementById('camera-fallback-wrapper') as HTMLElement;
  const fallbackInput = document.getElementById('input-camera-fallback') as HTMLInputElement;
  
  if (video) {
    video.style.display = 'none';
    video.srcObject = null;
  }
  if (placeholder) placeholder.style.display = 'flex';
  if (preview) {
    preview.style.display = 'none';
    preview.src = '';
  }
  if (btnStart) btnStart.style.display = 'inline-flex';
  if (btnCapture) btnCapture.style.display = 'none';
  if (btnReset) btnReset.style.display = 'none';
  if (fallbackWrapper) fallbackWrapper.style.display = 'inline-flex';
  if (fallbackInput) fallbackInput.value = '';
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
      resetCameraUI();
    });
  }

  if (btnCancelEntry) {
    btnCancelEntry.addEventListener('click', () => {
      resetCameraUI();
      showView('dashboard', currentUser);
    });
  }

  // Delete Account Action
  const btnDeleteAccount = document.getElementById('btn-delete-account') as HTMLButtonElement;
  if (btnDeleteAccount) {
    btnDeleteAccount.addEventListener('click', async () => {
      const confirmFirst = confirm(
        'Are you absolutely sure you want to delete your Guestbook account?\n\nThis will permanently delete all your guestbook entries, uploaded photos, and profile logs. This action cannot be undone.'
      );
      if (!confirmFirst) return;

      const confirmText = prompt(
        "To confirm deletion, please type 'DELETE' in the input box below:"
      );
      if (confirmText !== 'DELETE') {
        alert('Account deletion cancelled. Confirmation phrase did not match.');
        return;
      }

      try {
        btnDeleteAccount.disabled = true;
        btnDeleteAccount.textContent = 'Deleting Account...';
        
        await deleteUserAccount();
        alert('Your account and all associated data have been permanently deleted. Thank you for your visit.');
      } catch (err: any) {
        console.error('Failed to delete account:', err);
        alert(`Failed to delete account: ${err.message || 'Unknown database error'}`);
        btnDeleteAccount.disabled = false;
        btnDeleteAccount.textContent = 'Delete My Account';
      }
    });
  }

  // 5.5. Admin Navigation & Tab Switcher triggers
  const btnNavAdmin = document.getElementById('btn-nav-admin');
  const btnAdminBack = document.getElementById('btn-admin-back');

  if (btnNavAdmin) {
    btnNavAdmin.addEventListener('click', () => {
      showView('admin', currentUser);
    });
  }

  if (btnAdminBack) {
    btnAdminBack.addEventListener('click', () => {
      showView('dashboard', currentUser);
    });
  }

  const adminTabButtons = document.querySelectorAll('.admin-tab-btn');
  adminTabButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      const tabName = target.getAttribute('data-tab');
      
      adminTabButtons.forEach(b => b.classList.remove('active'));
      target.classList.add('active');

      const panes = document.querySelectorAll('.admin-tab-pane') as NodeListOf<HTMLElement>;
      panes.forEach(p => p.style.display = 'none');

      const activePane = document.getElementById(`pane-${tabName}`);
      if (activePane) activePane.style.display = 'block';

      const filtersBar = document.getElementById('admin-filters-bar');
      if (filtersBar) {
        filtersBar.style.display = tabName === 'all' ? 'flex' : 'none';
      }
    });
  });

  const adminSearchInput = document.getElementById('input-admin-search');
  const adminStatusFilter = document.getElementById('select-admin-filter-status');
  const btnAdminExportCSV = document.getElementById('btn-admin-export-csv');
  
  if (adminSearchInput) {
    adminSearchInput.addEventListener('input', () => {
      renderAdminAllTab();
    });
  }

  if (adminStatusFilter) {
    adminStatusFilter.addEventListener('change', () => {
      renderAdminAllTab();
    });
  }

  if (btnAdminExportCSV) {
    btnAdminExportCSV.addEventListener('click', () => {
      exportAdminEntriesToCSV();
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

  // 7.5. Selfie Camera Event Listeners
  const btnCameraStart = document.getElementById('btn-camera-start');
  const btnCameraCapture = document.getElementById('btn-camera-capture');
  const btnCameraReset = document.getElementById('btn-camera-reset');
  const cameraVideo = document.getElementById('camera-video') as HTMLVideoElement;
  const cameraPlaceholder = document.getElementById('camera-placeholder');
  const cameraPreview = document.getElementById('camera-preview') as HTMLImageElement;
  const cameraFallbackWrapper = document.getElementById('camera-fallback-wrapper');
  const inputCameraFallback = document.getElementById('input-camera-fallback') as HTMLInputElement;

  if (btnCameraStart) {
    btnCameraStart.addEventListener('click', async () => {
      if (!cameraVideo) return;
      try {
        if (btnCameraStart instanceof HTMLButtonElement) {
          btnCameraStart.disabled = true;
          btnCameraStart.textContent = 'Accessing...';
        }
        await startWebcam(cameraVideo);
        
        cameraVideo.style.display = 'block';
        if (cameraPlaceholder) cameraPlaceholder.style.display = 'none';
        if (cameraPreview) cameraPreview.style.display = 'none';
        if (btnCameraStart) btnCameraStart.style.display = 'none';
        if (btnCameraCapture) btnCameraCapture.style.display = 'inline-flex';
        if (btnCameraReset) btnCameraReset.style.display = 'none';
      } catch (err: any) {
        console.error('Webcam access failed:', err);
        alert(`Could not access webcam: ${err.message || 'Permission denied or no device found.'}\nPlease use the file upload option instead.`);
      } finally {
        if (btnCameraStart instanceof HTMLButtonElement) {
          btnCameraStart.disabled = false;
          btnCameraStart.textContent = 'Start Camera';
        }
      }
    });
  }

  if (btnCameraCapture) {
    btnCameraCapture.addEventListener('click', async () => {
      if (!cameraVideo || !cameraPreview) return;
      try {
        const blob = await captureFrame(cameraVideo);
        activeSelfieBlob = blob;
        
        cameraPreview.src = URL.createObjectURL(blob);
        cameraPreview.style.display = 'block';
        
        stopWebcam();
        
        cameraVideo.style.display = 'none';
        if (btnCameraCapture) btnCameraCapture.style.display = 'none';
        if (btnCameraReset) {
          btnCameraReset.style.display = 'inline-flex';
          btnCameraReset.textContent = 'Retake Photo';
        }
        if (cameraFallbackWrapper) cameraFallbackWrapper.style.display = 'none';
      } catch (err: any) {
        console.error('Frame capture failed:', err);
        alert(`Failed to capture photo: ${err.message || 'Unknown error'}`);
      }
    });
  }

  if (btnCameraReset) {
    btnCameraReset.addEventListener('click', async () => {
      const isFallback = inputCameraFallback && inputCameraFallback.value !== '';
      
      activeSelfieBlob = null;
      if (cameraPreview) {
        cameraPreview.src = '';
        cameraPreview.style.display = 'none';
      }
      if (inputCameraFallback) inputCameraFallback.value = '';

      if (isFallback) {
        resetCameraUI();
      } else if (cameraVideo) {
        try {
          if (btnCameraReset instanceof HTMLButtonElement) {
            btnCameraReset.disabled = true;
            btnCameraReset.textContent = 'Accessing...';
          }
          await startWebcam(cameraVideo);
          
          cameraVideo.style.display = 'block';
          if (cameraPlaceholder) cameraPlaceholder.style.display = 'none';
          if (btnCameraStart) btnCameraStart.style.display = 'none';
          if (btnCameraCapture) btnCameraCapture.style.display = 'inline-flex';
          if (btnCameraReset) btnCameraReset.style.display = 'none';
          if (cameraFallbackWrapper) cameraFallbackWrapper.style.display = 'inline-flex';
        } catch (err: any) {
          console.error('Webcam restart failed:', err);
          alert(`Could not access webcam: ${err.message || 'Permission denied or no device found.'}`);
          resetCameraUI();
        } finally {
          if (btnCameraReset instanceof HTMLButtonElement) {
            btnCameraReset.disabled = false;
            btnCameraReset.textContent = 'Retake Photo';
          }
        }
      } else {
        resetCameraUI();
      }
    });
  }

  if (inputCameraFallback) {
    inputCameraFallback.addEventListener('change', async (e) => {
      const target = e.target as HTMLInputElement;
      if (!target.files || target.files.length === 0) return;
      
      const file = target.files[0];
      try {
        const blob = await processUploadedFile(file);
        activeSelfieBlob = blob;
        
        stopWebcam();
        if (cameraVideo) cameraVideo.style.display = 'none';
        if (cameraPlaceholder) cameraPlaceholder.style.display = 'none';
        
        cameraPreview.src = URL.createObjectURL(blob);
        cameraPreview.style.display = 'block';
        
        if (btnCameraStart) btnCameraStart.style.display = 'none';
        if (btnCameraCapture) btnCameraCapture.style.display = 'none';
        if (btnCameraReset) {
          btnCameraReset.style.display = 'inline-flex';
          btnCameraReset.textContent = 'Clear Photo';
        }
      } catch (err: any) {
        console.error('File process failed:', err);
        alert(`Failed to upload photo: ${err.message || 'File must be an image.'}`);
        inputCameraFallback.value = '';
      }
    });
  }

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
        const replacementIdInput = document.getElementById('input-entry-replacement-id') as HTMLInputElement;
        const replacementId = replacementIdInput ? replacementIdInput.value : '';
        const mode = replacementIdInput ? replacementIdInput.dataset.mode : '';

        if (btnSubmitEntry) {
          btnSubmitEntry.disabled = true;
          btnSubmitEntry.textContent = mode === 'edit' ? 'Saving...' : 'Submitting...';
        }

        if (replacementId) {
          await replaceGuestbookEntry(replacementId, name, message, finalMood, activeSelfieBlob);
          if (mode === 'edit') {
            alert('Your entry was successfully updated!');
          } else {
            alert('Your replacement entry was successfully submitted and is pending review!');
          }
        } else {
          await createGuestbookEntry(name, message, finalMood, true, activeSelfieBlob);
          alert('Your entry was successfully submitted and is pending review!');
        }
        
        // Return to dashboard
        resetCameraUI();
        showView('dashboard', currentUser);
      } catch (err: any) {
        console.error('Failed to save guestbook entry:', err);
        alert(`Failed to save entry: ${err.message || 'Unknown database error'}`);
      } finally {
        if (btnSubmitEntry) {
          const replacementIdInput = document.getElementById('input-entry-replacement-id') as HTMLInputElement;
          const mode = replacementIdInput ? replacementIdInput.dataset.mode : '';
          if (mode === 'edit') {
            btnSubmitEntry.textContent = 'Save Changes';
          } else if (mode === 'replace') {
            btnSubmitEntry.textContent = 'Submit Replacement';
          } else {
            btnSubmitEntry.textContent = 'Submit Entry';
          }
          validateConsentState();
        }
      }
    });
  }

  // 10. Subscribe to Supabase Auth State Shifts
  if (hasValidConfig) {
    onAuthChange(async (event, session) => {
      console.log(`Auth state change triggered: ${event}`);
      currentUser = session?.user || null;
      
      resetCameraUI();
      
      if (currentUser) {
        const isAdmin = await isCurrentUserAdmin();
        updateNavigation(currentUser, isAdmin);
        showView('dashboard', currentUser);
      } else {
        updateNavigation(null, false);
        showView('welcome');
      }
    });
  } else {
    // If not configured, render default public view and connection warning
    updateNavigation(null, false);
    showView('welcome');
  }

  console.log('Guestbook: Main scripts booted and aligned with Portfolio theme.');
});
