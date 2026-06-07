import { hasValidConfig } from './db/supabaseClient';
import { fetchUserEntries, getSignedSelfieUrl } from './db/queries';

/**
 * Hides all main view sections and shows only the targeted view.
 */
async function showView(viewName: 'welcome' | 'login' | 'dashboard' | 'create-entry', user?: any) {
  const welcomeSection = document.getElementById('hero-welcome');
  const loginSection = document.getElementById('login-panel');
  const dashboardSection = document.getElementById('dashboard-panel');
  const createEntrySection = document.getElementById('create-entry-panel');

  if (welcomeSection) welcomeSection.style.display = 'none';
  if (loginSection) loginSection.style.display = 'none';
  if (dashboardSection) dashboardSection.style.display = 'none';
  if (createEntrySection) createEntrySection.style.display = 'none';

  if (viewName === 'welcome' && welcomeSection) {
    welcomeSection.style.display = 'block';
  } else if (viewName === 'login' && loginSection) {
    loginSection.style.display = 'block';
  } else if (viewName === 'dashboard' && dashboardSection) {
    dashboardSection.style.display = 'block';
    
    // Update user context in Dashboard if provided
    const dashboardSubtitle = dashboardSection.querySelector('.section-subtitle');
    if (dashboardSubtitle && user) {
      dashboardSubtitle.textContent = `Logged in as ${user.email}. Manage your private memories.`;
    }
    
    // Trigger dashboard loading
    await loadUserDashboard();
  } else if (viewName === 'create-entry' && createEntrySection) {
    createEntrySection.style.display = 'block';
    resetCreateEntryForm();
  }
}

/**
 * Resets the Guestbook Entry creation form controls and counters.
 */
function resetCreateEntryForm() {
  const form = document.getElementById('form-create-entry') as HTMLFormElement;
  if (!form) return;
  
  form.reset();

  const charCounter = document.getElementById('char-counter');
  if (charCounter) {
    charCounter.textContent = '0 / 200';
    charCounter.className = 'char-counter-text';
  }

  const customMoodInput = document.getElementById('input-entry-custom-mood') as HTMLInputElement;
  if (customMoodInput) {
    customMoodInput.style.display = 'none';
    customMoodInput.value = '';
  }

  const moodPills = document.querySelectorAll('.mood-pill');
  moodPills.forEach(pill => pill.classList.remove('active'));

  const submitBtn = document.getElementById('btn-submit-entry') as HTMLButtonElement;
  if (submitBtn) {
    submitBtn.disabled = true;
  }
}

/**
 * Updates the header navigation controls based on authentication state.
 */
function updateNavigation(user: any | null) {
  const statusIndicator = document.getElementById('auth-status-indicator');
  const userProfileNav = document.getElementById('nav-user-profile');
  const navUserEmail = document.getElementById('nav-user-email');

  if (user) {
    // Hide connection status, show profile controls
    if (statusIndicator) statusIndicator.style.display = 'none';
    if (userProfileNav) userProfileNav.style.display = 'flex';
    if (navUserEmail) navUserEmail.textContent = user.email || '';
  } else {
    // Show connection status, hide profile controls
    if (userProfileNav) userProfileNav.style.display = 'none';
    if (statusIndicator) {
      statusIndicator.style.display = 'inline-flex';
      
      // Configure indicator appearance depending on config variables
      if (hasValidConfig) {
        statusIndicator.textContent = 'Connected';
        statusIndicator.className = 'nav-status-indicator connected';
        statusIndicator.style.borderColor = ''; // reset custom border
      } else {
        statusIndicator.textContent = 'Configure Database';
        statusIndicator.className = 'nav-status-indicator';
        statusIndicator.style.borderColor = 'var(--danger)';
      }
    }
  }
}

/**
 * Loads and renders the visitor's guestbook entries in the dashboard view.
 */
async function loadUserDashboard() {
  const entriesListContainer = document.getElementById('dashboard-entries-list');
  if (!entriesListContainer) return;

  // Render a loading spinner first
  entriesListContainer.innerHTML = `
    <div class="writings-state-container">
      <div class="loading-spinner"></div>
      <p>Fetching your memories archive...</p>
    </div>
  `;

  try {
    const entries = (await fetchUserEntries()) as any[];
    entriesListContainer.innerHTML = '';

    if (entries.length === 0) {
      entriesListContainer.innerHTML = `
        <p class="empty-helper">No guestbook entries found. Write your first memory!</p>
      `;
      return;
    }

    // Loop and render entries
    for (const entry of entries) {
      const card = createEntryCard(entry);
      entriesListContainer.appendChild(card);
      
      // Asynchronously load signed URL if selfie is present
      if (entry.selfie_url) {
        loadCardSelfie(card, entry.selfie_url);
      }
    }

    // Bind event listeners on dynamically rendered elements
    bindDashboardActionListeners(entriesListContainer);

  } catch (error: any) {
    console.error('Error rendering dashboard:', error);
    entriesListContainer.innerHTML = `
      <div class="writings-state-container error">
        <svg class="error-icon" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p>Failed to load archive: ${error.message || 'Unknown database error'}</p>
        <span class="error-helper">Make sure the SQL schemas are correctly initialized in your Supabase project.</span>
      </div>
    `;
  }
}

/**
 * Creates the DOM element for a single guestbook entry card.
 */
function createEntryCard(entry: any): HTMLElement {
  const card = document.createElement('div');
  card.className = 'entry-card glass-hover animate-fade-in';
  
  // Format Date (matching portfolio style)
  const dateOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  const formattedDate = new Date(entry.created_at).toLocaleDateString(undefined, dateOptions);

  // Status mapping
  let statusText = 'Pending Review';
  let statusClass = 'pending';
  let statusDescription = '';

  if (entry.status === 'approved') {
    statusText = 'Approved';
    statusClass = 'approved';
  } else if (entry.status === 'rejected') {
    statusText = 'Rejected';
    statusClass = 'rejected';
    
    // Map human-readable rejection reasons
    const reasonMap: Record<string, string> = {
      unclear_photo: 'Unclear Photo',
      inappropriate_content: 'Inappropriate Content',
      image_not_visitor: 'Image does not show visitor',
      duplicate_submission: 'Duplicate Submission',
      spam_submission: 'Spam/Abuse Submission',
      other: 'Other'
    };
    
    const friendlyReason = reasonMap[entry.rejection_reason] || 'Moderator Decision';
    const customDetail = entry.custom_rejection_reason ? `: ${entry.custom_rejection_reason}` : '';
    statusDescription = `<p class="rejection-reason-box">Reason: <strong>${friendlyReason}${customDetail}</strong></p>`;
  }

  card.innerHTML = `
    <div class="entry-card-header">
      <div class="entry-user-info">
        <span class="entry-name">${escapeHtml(entry.original_name)}</span>
        <span class="entry-date">${formattedDate}</span>
      </div>
      <div class="entry-status-badge ${statusClass}">
        <span class="status-dot"></span>
        <span class="status-text">${statusText}</span>
      </div>
    </div>
    
    <div class="entry-card-body">
      ${entry.selfie_url ? `
        <div class="entry-selfie-frame">
          <div class="selfie-loader-spinner"></div>
          <img class="entry-selfie" alt="Selfie Memory" style="display: none;" />
        </div>
      ` : ''}
      <p class="entry-message">"${escapeHtml(entry.message)}"</p>
      ${statusDescription}
    </div>
    
    <div class="entry-card-footer">
      <div class="entry-footer-left">
        ${entry.mood ? `<span class="tag-pill">${escapeHtml(entry.mood)}</span>` : ''}
      </div>
      <div class="entry-footer-right">
        ${entry.status === 'approved' && entry.selfie_url ? `
          <button class="btn-download btn-text-action" data-path="${entry.selfie_url}" aria-label="Download Photo">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download Photo
          </button>
        ` : ''}
        ${entry.status === 'rejected' && entry.reupload_attempts < 3 ? `
          <button class="btn-replace btn-action-pill" data-id="${entry.id}">
            Replace Submission (${entry.reupload_attempts}/3)
          </button>
        ` : ''}
      </div>
    </div>
  `;

  return card;
}

/**
 * Asynchronously fetches a signed URL for a selfie and renders it inside its frame.
 */
async function loadCardSelfie(card: HTMLElement, selfieUrl: string) {
  const imgElement = card.querySelector('.entry-selfie') as HTMLImageElement;
  const loaderElement = card.querySelector('.selfie-loader-spinner') as HTMLElement;
  
  if (!imgElement) return;

  try {
    const signedUrl = await getSignedSelfieUrl(selfieUrl);
    if (signedUrl) {
      imgElement.src = signedUrl;
      imgElement.onload = () => {
        if (loaderElement) loaderElement.style.display = 'none';
        imgElement.style.display = 'block';
      };
    } else {
      throw new Error('Signed URL returned null');
    }
  } catch (err) {
    console.error('Failed to load signed URL for image card:', err);
    if (loaderElement) {
      loaderElement.innerHTML = `
        <span class="selfie-error-icon">⚠️</span>
        <span style="font-size: 0.72rem; color: var(--text-muted);">Failed to load photo</span>
      `;
      loaderElement.style.borderColor = 'transparent';
    }
  }
}

/**
 * Binds click action event listeners for dynamically added buttons.
 */
function bindDashboardActionListeners(container: HTMLElement) {
  // 1. Download Actions
  const downloadButtons = container.querySelectorAll('.btn-download');
  downloadButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const button = e.currentTarget as HTMLButtonElement;
      const filePath = button.getAttribute('data-path');
      if (!filePath) return;

      try {
        button.disabled = true;
        const signedUrl = await getSignedSelfieUrl(filePath);
        if (signedUrl) {
          // Open image in a new tab to let user save/view
          window.open(signedUrl, '_blank');
        } else {
          alert('Could not download image.');
        }
      } catch (err) {
        console.error(err);
      } finally {
        button.disabled = false;
      }
    });
  });

  // 2. Replace Actions (Stub for Phase 9)
  const replaceButtons = container.querySelectorAll('.btn-replace');
  replaceButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const button = e.currentTarget as HTMLButtonElement;
      const entryId = button.getAttribute('data-id');
      alert(`Replace Submission clicked for ID ${entryId}. This will be fully wired in Phase 9 Rejection Management!`);
    });
  });
}

/**
 * Simple helper to escape HTML and prevent XSS injection.
 */
function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export {
  showView,
  updateNavigation,
  loadUserDashboard
};
