import { hasValidConfig } from './db/supabaseClient';
import { showConfirm } from './dialog';
import { 
  fetchUserEntries, 
  getSignedSelfieUrl, 
  checkUserSubmissionLimits,
  fetchAdminEntries,
  fetchAuditLogs,
  moderateGuestbookEntry,
  deleteGuestbookEntry,
  fetchPublicEntries
} from './db/queries';

// Cache limits data to prevent async file dialog issues on mobile devices
let cachedLimits: { dailyCount: number; weeklyCount: number; monthlyCount: number; lifetimeCount: number } | null = null;

// View navigation history tracking
let viewHistory: ('welcome' | 'login' | 'dashboard' | 'create-entry' | 'admin' | 'archive')[] = ['welcome'];
let isNavigatingBack = false;

/**
 * Navigates back to the previous view in history.
 */
function goBack(user?: any) {
  if (viewHistory.length > 1) {
    viewHistory.pop(); // Pop current view
    const prevView = viewHistory[viewHistory.length - 1];
    isNavigatingBack = true;
    showView(prevView, user);
  } else {
    isNavigatingBack = true;
    showView('welcome', user);
  }
}

/**
 * Hides all main view sections and shows only the targeted view.
 */
async function showView(viewName: 'welcome' | 'login' | 'dashboard' | 'create-entry' | 'admin' | 'archive', user?: any) {
  // Update view history
  if (viewName === 'welcome' || viewName === 'dashboard') {
    viewHistory = [viewName];
  } else if (!isNavigatingBack) {
    if (viewHistory[viewHistory.length - 1] !== viewName) {
      viewHistory.push(viewName);
    }
  }
  isNavigatingBack = false;
  const welcomeSection = document.getElementById('hero-welcome');
  const loginSection = document.getElementById('login-panel');
  const dashboardSection = document.getElementById('dashboard-panel');
  const createEntrySection = document.getElementById('create-entry-panel');
  const adminSection = document.getElementById('admin-panel');
  const aboutProjectSection = document.getElementById('about-project');
  const archiveSection = document.getElementById('archive-panel');

  if (welcomeSection) welcomeSection.style.display = 'none';
  if (loginSection) loginSection.style.display = 'none';
  if (dashboardSection) dashboardSection.style.display = 'none';
  if (createEntrySection) createEntrySection.style.display = 'none';
  if (adminSection) adminSection.style.display = 'none';
  if (archiveSection) archiveSection.style.display = 'none';
  if (aboutProjectSection) {
    aboutProjectSection.style.display = (viewName === 'admin' || viewName === 'archive') ? 'none' : 'block';
  }

  if (viewName === 'welcome' && welcomeSection) {
    welcomeSection.style.display = 'block';
  } else if (viewName === 'login' && loginSection) {
    loginSection.style.display = 'block';
  } else if (viewName === 'dashboard' && dashboardSection) {
    dashboardSection.style.display = 'block';
    
    // Update user context in Dashboard if provided
    const dashboardSubtitle = dashboardSection.querySelector('.section-subtitle');
    if (dashboardSubtitle && user) {
      dashboardSubtitle.textContent = `Manage your private memories.`;
    }
    
    // Trigger dashboard loading
    await loadUserDashboard();
  } else if (viewName === 'create-entry' && createEntrySection) {
    createEntrySection.style.display = 'block';
    resetCreateEntryForm();
  } else if (viewName === 'admin' && adminSection) {
    adminSection.style.display = 'block';
    await loadAdminDashboard();
  } else if (viewName === 'archive' && archiveSection) {
    archiveSection.style.display = 'block';
    await renderPublicFeed();
  }
}

/**
 * Resets the Guestbook Entry creation form controls and counters.
 */
function resetCreateEntryForm() {
  const form = document.getElementById('form-create-entry') as HTMLFormElement;
  if (!form) return;
  
  form.reset();

  // Reset publicity option checkbox
  const isPublicCheckbox = document.getElementById('checkbox-is-public') as HTMLInputElement;
  if (isPublicCheckbox) {
    isPublicCheckbox.checked = false;
  }

  // Reset replacement-specific form state and headers
  const replacementInput = document.getElementById('input-entry-replacement-id') as HTMLInputElement;
  if (replacementInput) {
    replacementInput.value = '';
    replacementInput.dataset.mode = '';
  }

  const title = document.getElementById('create-entry-title');
  if (title) title.textContent = 'Leave a Memory';

  const subtitle = document.getElementById('create-entry-subtitle');
  if (subtitle) subtitle.textContent = 'Capture a moment from your visit. Tell us how you feel today.';

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
    submitBtn.textContent = 'Submit Entry';
  }
}

/**
 * Updates the header navigation controls based on authentication state.
 */
function updateNavigation(user: any | null, isAdmin: boolean = false) {
  const statusIndicator = document.getElementById('auth-status-indicator');
  const userProfileNav = document.getElementById('nav-user-profile');
  const navUserEmail = document.getElementById('nav-user-email');
  const btnNavAdmin = document.getElementById('btn-nav-admin');

  const btnLoginRedirect = document.getElementById('btn-login-redirect');
  if (btnLoginRedirect) {
    btnLoginRedirect.textContent = user ? 'Go to Dashboard' : 'Sign In to Leave an Entry';
  }

  if (user) {
    // Hide connection status, show profile controls
    if (statusIndicator) statusIndicator.style.display = 'none';
    if (userProfileNav) userProfileNav.style.display = 'flex';
    if (navUserEmail) navUserEmail.textContent = user.email || '';
    
    // Display admin panel navigation trigger if user has admin role
    if (btnNavAdmin) {
      btnNavAdmin.style.display = isAdmin ? 'inline-flex' : 'none';
    }
  } else {
    // Show connection status, hide profile controls
    if (userProfileNav) userProfileNav.style.display = 'none';
    if (btnNavAdmin) btnNavAdmin.style.display = 'none';
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
    // Run database queries concurrently
    const [entriesData, limitsData] = await Promise.all([
      fetchUserEntries(),
      checkUserSubmissionLimits()
    ]);

    userEntries = entriesData as any[];
    const entries = userEntries;
    entriesListContainer.innerHTML = '';

    // 1. Update Limits Warning and Button Status
    updateDashboardLimitsUI(limitsData);

    // 2. Render Log list
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

      // Add click handler to open the detailed modal
      card.addEventListener('click', () => {
        openMemoryDetailModal(entry, true);
      });
    }

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
 * Updates the dashboard rate limit indicator states.
 */
function updateDashboardLimitsUI(limits: { dailyCount: number; weeklyCount: number; monthlyCount: number; lifetimeCount: number }) {
  cachedLimits = limits;

  const triggerBtn = document.getElementById('btn-create-entry-trigger') as HTMLButtonElement;
  const actionCard = document.querySelector('.dashboard-action-card') as HTMLElement;
  
  if (!triggerBtn || !actionCard) return;

  // Clear existing warning if present
  const existingWarning = actionCard.querySelector('.rate-limit-warning-banner');
  if (existingWarning) {
    existingWarning.remove();
  }

  // Button is always enabled now, warnings checked dynamically before capturing/uploading photos
  triggerBtn.disabled = false;
  triggerBtn.title = '';
}

/**
 * Creates the DOM element for a single guestbook entry card.
 */
function createEntryCard(entry: any): HTMLElement {
  const card = document.createElement('div');
  card.className = 'entry-card glass-hover animate-fade-in';
  card.style.cursor = 'pointer';
  
  // Format Date (matching portfolio style)
  const dateOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  const formattedDate = new Date(entry.created_at).toLocaleDateString(undefined, dateOptions);

  card.innerHTML = `
    <div class="entry-card-header">
      <div class="entry-user-info">
        <span class="entry-name">${escapeHtml(entry.original_name)}</span>
        <span class="entry-date">${formattedDate}</span>
      </div>
    </div>
    
    <div class="entry-card-body" style="flex-grow: 1;">
      ${entry.selfie_url ? `
        <div class="entry-selfie-frame">
          <div class="selfie-loader-spinner"></div>
          <img class="entry-selfie" alt="Selfie Memory" style="display: none;" />
        </div>
      ` : `
        <div class="entry-selfie-frame" style="display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.02); min-height: 120px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.3;">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          <span style="font-size: 0.82rem; opacity: 0.4; margin-left: 8px;">Text memory</span>
        </div>
      `}
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
/**
 * Triggers the replacement flow for a rejected entry.
 */
function triggerReplaceAction(entry: any) {
  // Check reupload attempts constraint
  if (entry.reupload_attempts >= 3) {
    alert('Maximum replacement attempts exceeded. You cannot replace this entry anymore.');
    return;
  }

  // Set the hidden input value to mark this form as a replacement request
  const replacementInput = document.getElementById('input-entry-replacement-id') as HTMLInputElement;
  if (replacementInput) {
    replacementInput.value = entry.id;
    replacementInput.dataset.mode = 'replace';
  }

  // Pre-fill publicity checkbox
  const isPublicCheckbox = document.getElementById('checkbox-is-public') as HTMLInputElement;
  if (isPublicCheckbox) {
    isPublicCheckbox.checked = !!entry.is_public;
  }

  // Pre-fill fields
  const nameInput = document.getElementById('input-entry-name') as HTMLInputElement;
  if (nameInput) nameInput.value = entry.original_name || '';

  const messageInput = document.getElementById('input-entry-message') as HTMLTextAreaElement;
  if (messageInput) {
    messageInput.value = entry.message || '';
    
    // Trigger character counter state update
    const charCounter = document.getElementById('char-counter');
    if (charCounter) {
      const len = messageInput.value.length;
      charCounter.textContent = `${len} / 200`;
      if (len >= 180 && len < 200) {
        charCounter.className = 'char-counter-text warning';
      } else if (len >= 200) {
        charCounter.className = 'char-counter-text danger';
      } else {
        charCounter.className = 'char-counter-text';
      }
    }
  }

  // Pre-select Mood pill
  const moodPills = document.querySelectorAll('#mood-pills-wrapper .mood-pill');
  const customMoodInput = document.getElementById('input-entry-custom-mood') as HTMLInputElement;
  
  let matchedPill = false;
  moodPills.forEach(pill => {
    const moodVal = pill.getAttribute('data-mood');
    if (moodVal === entry.mood) {
      pill.classList.add('active');
      matchedPill = true;
    } else {
      pill.classList.remove('active');
    }
  });

  if (entry.mood && !matchedPill) {
    // It's a custom mood
    const customPill = document.getElementById('mood-pill-custom');
    if (customPill) customPill.classList.add('active');
    if (customMoodInput) {
      customMoodInput.style.display = 'block';
      customMoodInput.value = entry.mood;
    }
  } else {
    if (customMoodInput) {
      customMoodInput.style.display = 'none';
      customMoodInput.value = '';
    }
  }

  // Uncheck checkboxes for consent re-verification
  const consentModeration = document.getElementById('checkbox-consent-moderation') as HTMLInputElement;
  const consentStorage = document.getElementById('checkbox-consent-storage') as HTMLInputElement;
  if (consentModeration) consentModeration.checked = false;
  if (consentStorage) consentStorage.checked = false;

  // Update headers for replacement context
  const title = document.getElementById('create-entry-title');
  if (title) title.textContent = 'Replace Submission';

  const subtitle = document.getElementById('create-entry-subtitle');
  if (subtitle) subtitle.textContent = `Update your message, mood, or photo for re-review (Attempt ${entry.reupload_attempts + 1} of 3).`;

  const submitBtn = document.getElementById('btn-submit-entry') as HTMLButtonElement;
  if (submitBtn) {
    submitBtn.disabled = true; // Requires new consent checks
    submitBtn.textContent = 'Submit Replacement';
  }

  // Switch to the create-entry panel view
  showView('create-entry');
}

/**
 * Triggers the edit flow for a pending entry.
 */
function triggerEditAction(entry: any) {
  // Set the hidden input value to mark this form as an edit request
  const replacementInput = document.getElementById('input-entry-replacement-id') as HTMLInputElement;
  if (replacementInput) {
    replacementInput.value = entry.id;
    replacementInput.dataset.mode = 'edit';
  }

  // Pre-fill publicity checkbox
  const isPublicCheckbox = document.getElementById('checkbox-is-public') as HTMLInputElement;
  if (isPublicCheckbox) {
    isPublicCheckbox.checked = !!entry.is_public;
  }

  // Pre-fill fields
  const nameInput = document.getElementById('input-entry-name') as HTMLInputElement;
  if (nameInput) nameInput.value = entry.original_name || '';

  const messageInput = document.getElementById('input-entry-message') as HTMLTextAreaElement;
  if (messageInput) {
    messageInput.value = entry.message || '';
    
    // Trigger character counter state update
    const charCounter = document.getElementById('char-counter');
    if (charCounter) {
      const len = messageInput.value.length;
      charCounter.textContent = `${len} / 200`;
      if (len >= 180 && len < 200) {
        charCounter.className = 'char-counter-text warning';
      } else if (len >= 200) {
        charCounter.className = 'char-counter-text danger';
      } else {
        charCounter.className = 'char-counter-text';
      }
    }
  }

  // Pre-select Mood pill
  const moodPills = document.querySelectorAll('#mood-pills-wrapper .mood-pill');
  const customMoodInput = document.getElementById('input-entry-custom-mood') as HTMLInputElement;
  
  let matchedPill = false;
  moodPills.forEach(pill => {
    const moodVal = pill.getAttribute('data-mood');
    if (moodVal === entry.mood) {
      pill.classList.add('active');
      matchedPill = true;
    } else {
      pill.classList.remove('active');
    }
  });

  if (entry.mood && !matchedPill) {
    // It's a custom mood
    const customPill = document.getElementById('mood-pill-custom');
    if (customPill) customPill.classList.add('active');
    if (customMoodInput) {
      customMoodInput.style.display = 'block';
      customMoodInput.value = entry.mood;
    }
  } else {
    if (customMoodInput) {
      customMoodInput.style.display = 'none';
      customMoodInput.value = '';
    }
  }

  // Uncheck checkboxes for consent re-verification
  const consentModeration = document.getElementById('checkbox-consent-moderation') as HTMLInputElement;
  const consentStorage = document.getElementById('checkbox-consent-storage') as HTMLInputElement;
  if (consentModeration) consentModeration.checked = false;
  if (consentStorage) consentStorage.checked = false;

  // Update headers for edit context
  const title = document.getElementById('create-entry-title');
  if (title) title.textContent = 'Edit Submission';

  const subtitle = document.getElementById('create-entry-subtitle');
  if (subtitle) subtitle.textContent = 'Update your message, mood, or photo for your pending submission.';

  const submitBtn = document.getElementById('btn-submit-entry') as HTMLButtonElement;
  if (submitBtn) {
    submitBtn.disabled = true; // Requires new consent checks
    submitBtn.textContent = 'Save Changes';
  }

  // Switch to the create-entry panel view
  showView('create-entry');
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

// Track user data states globally inside this module
let userEntries: any[] = [];

// Track administrative data states globally inside this module
let adminEntries: any[] = [];
let adminLogs: any[] = [];

/**
 * Loads and renders the admin moderation panel.
 */
async function loadAdminDashboard() {
  const pendingList = document.getElementById('admin-pending-list');
  const allList = document.getElementById('admin-all-list');
  const logsList = document.getElementById('admin-logs-list');
  
  const badgePending = document.getElementById('badge-count-pending');
  const badgeAll = document.getElementById('badge-count-all');
  const badgeLogs = document.getElementById('badge-count-logs');

  if (!pendingList || !allList || !logsList) return;

  const spinnerHTML = `
    <div class="writings-state-container" style="grid-column: 1 / -1;">
      <div class="loading-spinner"></div>
      <p>Loading moderation archives...</p>
    </div>
  `;
  pendingList.innerHTML = spinnerHTML;
  allList.innerHTML = spinnerHTML;
  logsList.innerHTML = `<tr><td colspan="5" class="empty-helper"><div class="loading-spinner" style="margin: 0 auto 12px;"></div>Loading activity logs...</td></tr>`;

  try {
    const [entries, logs] = await Promise.all([
      fetchAdminEntries(),
      fetchAuditLogs()
    ]);

    adminEntries = entries as any[];
    adminLogs = logs as any[];

    // Render lists
    renderAdminPendingTab();
    renderAdminAllTab();
    renderAdminLogsTab();

    // Update badges
    const pendingCount = adminEntries.filter(e => e.status === 'pending').length;
    if (badgePending) badgePending.textContent = pendingCount.toString();
    if (badgeAll) badgeAll.textContent = adminEntries.length.toString();
    if (badgeLogs) badgeLogs.textContent = adminLogs.length.toString();

  } catch (error: any) {
    console.error('Error loading admin dashboard:', error);
    const errorHTML = `
      <div class="writings-state-container error" style="grid-column: 1 / -1;">
        <svg class="error-icon" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p>Failed to load admin panel: ${error.message || 'Access Denied or Database Error'}</p>
      </div>
    `;
    pendingList.innerHTML = errorHTML;
    allList.innerHTML = errorHTML;
    logsList.innerHTML = `<tr><td colspan="5" class="empty-helper" style="color: var(--danger);">Failed to load logs.</td></tr>`;
  }
}

/**
 * Renders the pending entries queue in the admin panel.
 */
function renderAdminPendingTab() {
  const pendingList = document.getElementById('admin-pending-list');
  if (!pendingList) return;

  const pendingEntries = adminEntries.filter(e => e.status === 'pending');
  pendingList.innerHTML = '';

  if (pendingEntries.length === 0) {
    pendingList.innerHTML = `
      <p class="empty-helper" style="grid-column: 1 / -1;">No pending submissions to review. Excellent work!</p>
    `;
    return;
  }

  pendingEntries.forEach(entry => {
    const card = createAdminModerationCard(entry);
    pendingList.appendChild(card);
    if (entry.selfie_url) {
      loadCardSelfie(card, entry.selfie_url);
    }
  });

  bindAdminPendingActions(pendingList);
}

/**
 * Renders the search-filtered full list of guestbook entries.
 */
function renderAdminAllTab() {
  const allList = document.getElementById('admin-all-list');
  if (!allList) return;

  const searchInput = document.getElementById('input-admin-search') as HTMLInputElement;
  const filterStatus = document.getElementById('select-admin-filter-status') as HTMLSelectElement;

  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const statusFilter = filterStatus ? filterStatus.value : 'all';

  let filtered = adminEntries;

  // Filter status
  if (statusFilter !== 'all') {
    filtered = filtered.filter(e => e.status === statusFilter);
  }

  // Filter search query (matches name or message)
  if (query) {
    filtered = filtered.filter(e => 
      (e.original_name && e.original_name.toLowerCase().includes(query)) ||
      (e.message && e.message.toLowerCase().includes(query))
    );
  }

  allList.innerHTML = '';

  if (filtered.length === 0) {
    allList.innerHTML = `
      <p class="empty-helper" style="grid-column: 1 / -1;">No entries match the filter criteria.</p>
    `;
    return;
  }

  filtered.forEach(entry => {
    const card = createAdminAllCard(entry);
    allList.appendChild(card);
    if (entry.selfie_url) {
      loadCardSelfie(card, entry.selfie_url);
    }
  });

  bindAdminAllActions(allList);
}

/**
 * Renders the admin audit logs table list.
 */
function renderAdminLogsTab() {
  const logsList = document.getElementById('admin-logs-list');
  if (!logsList) return;

  logsList.innerHTML = '';

  if (adminLogs.length === 0) {
    logsList.innerHTML = `
      <tr>
        <td colspan="5" class="empty-helper">No audit logs recorded yet.</td>
      </tr>
    `;
    return;
  }

  adminLogs.forEach(log => {
    const tr = document.createElement('tr');
    
    const dateOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    };
    const formattedDate = new Date(log.created_at).toLocaleDateString(undefined, dateOptions);

    let actionBadgeClass = 'deletion';
    let actionLabel = log.action;
    if (log.action === 'approval') {
      actionBadgeClass = 'approval';
      actionLabel = 'Approve';
    } else if (log.action === 'rejection') {
      actionBadgeClass = 'rejection';
      actionLabel = 'Reject';
    }

    let detailText = '';
    if (log.action === 'rejection' && log.details) {
      const reason = log.details.reason || '';
      const custom = log.details.custom_reason ? `: ${log.details.custom_reason}` : '';
      detailText = `Rejection Reason: ${reason}${custom}`;
    } else if (log.action === 'approval') {
      detailText = 'Approved entry';
    } else {
      detailText = log.details ? JSON.stringify(log.details) : '';
    }

    tr.innerHTML = `
      <td>${formattedDate}</td>
      <td><span class="log-action-badge ${actionBadgeClass}">${actionLabel}</span></td>
      <td class="log-target">${log.entry_id || 'N/A'}</td>
      <td class="log-actor">${log.actor_id || 'System'}</td>
      <td>${escapeHtml(detailText)}</td>
    `;
    logsList.appendChild(tr);
  });
}

/**
 * Creates the DOM element for a moderation entry card.
 */
function createAdminModerationCard(entry: any): HTMLElement {
  const card = document.createElement('div');
  card.className = 'entry-card glass-hover animate-fade-in';
  
  const dateOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  const formattedDate = new Date(entry.created_at).toLocaleDateString(undefined, dateOptions);

  card.innerHTML = `
    <div class="entry-card-header">
      <div class="entry-user-info">
        <span class="entry-name">${escapeHtml(entry.original_name)}</span>
        <span class="entry-date">${formattedDate}</span>
      </div>
      <div class="entry-card-badges" style="display: flex; gap: 8px; align-items: center;">
        <div class="entry-visibility-badge ${entry.is_public ? 'public' : 'private'}">
          <span class="visibility-dot"></span>
          <span class="visibility-text">${entry.is_public ? 'Public' : 'Private'}</span>
        </div>
        <div class="entry-status-badge pending">
          <span class="status-dot"></span>
          <span class="status-text">Pending</span>
        </div>
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
    </div>
    
    <div class="entry-card-footer" style="flex-direction: column; gap: 12px; align-items: stretch;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        ${entry.mood ? `<span class="tag-pill">${escapeHtml(entry.mood)}</span>` : '<span class="tag-pill">No Mood</span>'}
      </div>
      
      <!-- Moderation Actions -->
      <div class="entry-card-moderate-actions" id="moderate-actions-${entry.id}">
        <button class="btn-moderate-approve btn-primary" data-id="${entry.id}">
          Approve
        </button>
        <button class="btn-moderate-reject btn-secondary" data-id="${entry.id}">
          Reject
        </button>
      </div>

      <!-- Rejection selector (hidden initially) -->
      <div class="rejection-selector-panel" id="rejection-panel-${entry.id}" style="display: none;">
        <label for="select-reason-${entry.id}">Rejection Reason</label>
        <select id="select-reason-${entry.id}" class="form-input">
          <option value="unclear_photo">Unclear Photo</option>
          <option value="inappropriate_content">Inappropriate Content</option>
          <option value="image_not_visitor">Image does not show visitor</option>
          <option value="duplicate_submission">Duplicate Submission</option>
          <option value="spam_submission">Spam Submission</option>
          <option value="other">Other (Specify below)</option>
        </select>
        <input type="text" id="input-custom-reason-${entry.id}" class="form-input" placeholder="Type custom reason..." style="display: none; margin-top: 6px;" maxlength="100">
        <div class="rejection-actions-row" style="margin-top: 8px;">
          <button class="btn-rejection-submit" data-id="${entry.id}">Confirm Reject</button>
          <button class="btn-rejection-cancel btn-secondary" data-id="${entry.id}">Cancel</button>
        </div>
      </div>
    </div>
  `;
  return card;
}

/**
 * Creates the DOM element for all entries lists.
 */
function createAdminAllCard(entry: any): HTMLElement {
  const card = document.createElement('div');
  card.className = 'entry-card glass-hover animate-fade-in';
  
  const dateOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  const formattedDate = new Date(entry.created_at).toLocaleDateString(undefined, dateOptions);

  let statusClass = 'pending';
  let statusText = 'Pending';
  if (entry.status === 'approved') {
    statusClass = 'approved';
    statusText = 'Approved';
  } else if (entry.status === 'rejected') {
    statusClass = 'rejected';
    statusText = 'Rejected';
  }

  let detailsHTML = '';
  if (entry.status === 'rejected') {
    detailsHTML = `<p class="rejection-reason-box" style="margin-top: 8px;">Reason: <strong>${escapeHtml(entry.rejection_reason)}${entry.custom_rejection_reason ? ': ' + escapeHtml(entry.custom_rejection_reason) : ''}</strong></p>`;
  }

  card.innerHTML = `
    <div class="entry-card-header">
      <div class="entry-user-info">
        <span class="entry-name">${escapeHtml(entry.original_name)}</span>
        <span class="entry-date">${formattedDate}</span>
      </div>
      <div class="entry-card-badges" style="display: flex; gap: 8px; align-items: center;">
        <div class="entry-visibility-badge ${entry.is_public ? 'public' : 'private'}">
          <span class="visibility-dot"></span>
          <span class="visibility-text">${entry.is_public ? 'Public' : 'Private'}</span>
        </div>
        <div class="entry-status-badge ${statusClass}">
          <span class="status-dot"></span>
          <span class="status-text">${statusText}</span>
        </div>
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
      ${detailsHTML}
    </div>
    
    <div class="entry-card-footer" style="justify-content: space-between; align-items: center;">
      ${entry.mood ? `<span class="tag-pill">${escapeHtml(entry.mood)}</span>` : '<span class="tag-pill">No Mood</span>'}
      <button class="btn-moderate-delete btn-action-pill" data-id="${entry.id}" style="padding: 6px 12px; font-size: 0.8rem; background: var(--danger-light); color: var(--danger); border-color: rgba(239, 68, 68, 0.1);">
        Delete
      </button>
    </div>
  `;
  return card;
}

/**
 * Binds actions on the admin pending moderation queue card triggers.
 */
function bindAdminPendingActions(container: HTMLElement) {
  // 1. Approve Button Clicked
  const approveButtons = container.querySelectorAll('.btn-moderate-approve');
  approveButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const button = e.currentTarget as HTMLButtonElement;
      const entryId = button.getAttribute('data-id');
      if (!entryId) return;

      try {
        button.disabled = true;
        button.textContent = 'Approving...';
        await moderateGuestbookEntry(entryId, 'approved');
        
        // Reload dashboard
        await loadAdminDashboard();
      } catch (err: any) {
        console.error(err);
        alert(`Failed to approve entry: ${err.message || 'Database error'}`);
        button.disabled = false;
        button.textContent = 'Approve';
      }
    });
  });

  // 2. Reject Button Clicked (Toggles panel)
  const rejectButtons = container.querySelectorAll('.btn-moderate-reject');
  rejectButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const button = e.currentTarget as HTMLButtonElement;
      const entryId = button.getAttribute('data-id');
      if (!entryId) return;

      const actionsPanel = document.getElementById(`moderate-actions-${entryId}`);
      const rejectionPanel = document.getElementById(`rejection-panel-${entryId}`);
      const selectReason = document.getElementById(`select-reason-${entryId}`) as HTMLSelectElement;
      const customInput = document.getElementById(`input-custom-reason-${entryId}`) as HTMLInputElement;

      if (actionsPanel) actionsPanel.style.display = 'none';
      if (rejectionPanel) rejectionPanel.style.display = 'flex';
      
      // Bind select change trigger to show custom reason input
      if (selectReason) {
        selectReason.value = 'unclear_photo';
        if (customInput) customInput.style.display = 'none';
        
        selectReason.onchange = () => {
          if (customInput) {
            customInput.style.display = selectReason.value === 'other' ? 'block' : 'none';
            if (selectReason.value === 'other') customInput.focus();
          }
        };
      }
    });
  });

  // 3. Cancel Rejection Button Clicked
  const cancelButtons = container.querySelectorAll('.btn-rejection-cancel');
  cancelButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const button = e.currentTarget as HTMLButtonElement;
      const entryId = button.getAttribute('data-id');
      if (!entryId) return;

      const actionsPanel = document.getElementById(`moderate-actions-${entryId}`);
      const rejectionPanel = document.getElementById(`rejection-panel-${entryId}`);

      if (actionsPanel) actionsPanel.style.display = 'flex';
      if (rejectionPanel) rejectionPanel.style.display = 'none';
    });
  });

  // 4. Confirm Rejection Submit Clicked
  const confirmButtons = container.querySelectorAll('.btn-rejection-submit');
  confirmButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const button = e.currentTarget as HTMLButtonElement;
      const entryId = button.getAttribute('data-id');
      if (!entryId) return;

      const selectReason = document.getElementById(`select-reason-${entryId}`) as HTMLSelectElement;
      const customInput = document.getElementById(`input-custom-reason-${entryId}`) as HTMLInputElement;
      
      const reason = selectReason ? selectReason.value : 'other';
      const customReason = (reason === 'other' && customInput) ? customInput.value.trim() : '';

      if (reason === 'other' && !customReason) {
        alert('Please specify a rejection reason.');
        return;
      }

      try {
        button.disabled = true;
        button.textContent = 'Rejecting...';
        await moderateGuestbookEntry(entryId, 'rejected', reason, customReason || null);
        
        // Reload dashboard
        await loadAdminDashboard();
      } catch (err: any) {
        console.error(err);
        alert(`Failed to reject entry: ${err.message || 'Database error'}`);
        button.disabled = false;
        button.textContent = 'Confirm Reject';
      }
    });
  });
}

/**
 * Binds action buttons inside the full entries grid.
 */
function bindAdminAllActions(container: HTMLElement) {
  // Delete Button Clicked
  const deleteButtons = container.querySelectorAll('.btn-moderate-delete');
  deleteButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const button = e.currentTarget as HTMLButtonElement;
      const entryId = button.getAttribute('data-id');
      if (!entryId) return;

      const confirmed = await showConfirm(
        'Are you sure you want to delete this guestbook entry permanently? This action is irreversible.',
        'Delete Entry'
      );
      if (!confirmed) return;

      try {
        button.disabled = true;
        button.textContent = 'Deleting...';
        await deleteGuestbookEntry(entryId);
        
        // Reload dashboard
        await loadAdminDashboard();
      } catch (err: any) {
        console.error(err);
        alert(`Failed to delete entry: ${err.message || 'Database error'}`);
        button.disabled = false;
        button.textContent = 'Delete';
      }
    });
  });
}

/**
 * Compiles entry data and triggers a programmatically loaded CSV download.
 */
function exportAdminEntriesToCSV() {
  if (adminEntries.length === 0) {
    alert('No records available to export.');
    return;
  }

  // Define headers
  const headers = ['ID', 'User ID', 'Name', 'Mood', 'Message', 'Selfie Path', 'Status', 'Rejection Reason', 'Reupload Attempts', 'Created At'];
  
  // Map rows
  const rows = adminEntries.map(e => [
    e.id || '',
    e.user_id || '',
    e.original_name || '',
    e.mood || '',
    e.message || '',
    e.selfie_url || '',
    e.status || '',
    e.rejection_reason || '',
    e.reupload_attempts || 0,
    e.created_at || ''
  ]);

  // Convert to CSV string format
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  // Trigger file download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `guestbook_entries_export_${Date.now()}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Loads and renders public approved entries on the landing welcome page.
 */
async function renderPublicFeed() {
  const feedList = document.getElementById('public-feed-list');
  const feedContainer = document.getElementById('archive-panel');
  if (!feedList || !feedContainer) return;

  feedList.innerHTML = `
    <div class="writings-state-container" style="grid-column: 1 / -1;">
      <div class="loading-spinner"></div>
      <p style="font-size: 0.88rem; color: var(--text-muted);">Loading memories...</p>
    </div>
  `;

  try {
    const entries = await fetchPublicEntries();
    feedList.innerHTML = '';

    if (!entries || entries.length === 0) {
      feedList.innerHTML = `
        <p class="empty-helper" style="grid-column: 1 / -1;">No public memories shared yet. Be the first!</p>
      `;
      return;
    }

    entries.forEach((entry: any) => {
      const card = createPublicEntryCard(entry);
      feedList.appendChild(card);
      if (entry.selfie_url) {
        loadCardSelfie(card, entry.selfie_url);
      }

      // Open detail modal when clicking anywhere on the card
      card.addEventListener('click', () => {
        openMemoryDetailModal(entry, false);
      });
    });

  } catch (err) {
    console.error('Failed to load public feed:', err);
    feedList.innerHTML = `
      <div class="writings-state-container error" style="grid-column: 1 / -1; padding: 20px;">
        <svg class="error-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p style="font-size: 0.88rem;">Failed to load memories.</p>
      </div>
    `;
  }
}

/**
 * Opens the memory detail modal for public entries.
 */
/**
 * Opens the memory detail modal for both dashboard and public entries.
 */
async function openMemoryDetailModal(entry: any, isDashboardContext: boolean = false) {
  const modal = document.getElementById('memory-detail-modal');
  const modalImg = document.getElementById('memory-modal-image') as HTMLImageElement;
  const modalSpinner = document.getElementById('memory-modal-spinner');
  const modalName = document.getElementById('memory-modal-name');
  const modalDate = document.getElementById('memory-modal-date');
  const modalMood = document.getElementById('memory-modal-mood');
  const modalMessage = document.getElementById('memory-modal-message');
  const modalBadges = document.getElementById('memory-modal-badges');
  const modalRejectionBox = document.getElementById('memory-modal-rejection-box');
  const modalActions = document.getElementById('memory-modal-actions');

  if (!modal) return;

  const dateOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  const formattedDate = new Date(entry.created_at).toLocaleDateString(undefined, dateOptions);

  if (modalName) modalName.textContent = entry.original_name;
  if (modalDate) modalDate.textContent = formattedDate;
  if (modalMessage) modalMessage.textContent = `"${entry.message}"`;

  // Mood tag
  if (modalMood) {
    if (entry.mood) {
      modalMood.textContent = entry.mood;
      modalMood.style.display = 'inline-block';
    } else {
      modalMood.style.display = 'none';
    }
  }

  // Dashboard status / visibility badges
  if (modalBadges) {
    if (isDashboardContext) {
      let statusText = 'Pending Review';
      let statusClass = 'pending';
      if (entry.status === 'approved') {
        statusText = 'Approved';
        statusClass = 'approved';
      } else if (entry.status === 'rejected') {
        statusText = 'Rejected';
        statusClass = 'rejected';
      }

      const visibilityText = entry.is_public ? 'Public' : 'Private';
      const visibilityClass = entry.is_public ? 'public' : 'private';

      modalBadges.innerHTML = `
        <div class="entry-visibility-badge ${visibilityClass}" style="padding: 2px 8px; font-size: 0.68rem;">
          <span class="visibility-dot"></span>
          <span class="visibility-text">${visibilityText}</span>
        </div>
        <div class="entry-status-badge ${statusClass}" style="padding: 2px 8px; font-size: 0.68rem;">
          <span class="status-dot"></span>
          <span class="status-text">${statusText}</span>
        </div>
      `;
      modalBadges.style.display = 'flex';
    } else {
      modalBadges.style.display = 'none';
    }
  }

  // Dashboard rejection reason box
  if (modalRejectionBox) {
    if (isDashboardContext && entry.status === 'rejected') {
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
      
      modalRejectionBox.innerHTML = `
        <div class="rejection-reason-box" style="margin: 0; font-size: 0.82rem;">
          Reason: <strong>${friendlyReason}${customDetail}</strong>
        </div>
      `;
      modalRejectionBox.style.display = 'block';
    } else {
      modalRejectionBox.style.display = 'none';
    }
  }

  // Setup dynamic actions / buttons
  if (modalActions) {
    modalActions.innerHTML = '';

    if (isDashboardContext) {
      // 1. Download Photo button
      if (entry.status === 'approved' && entry.selfie_url) {
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn-download btn-text-action';
        downloadBtn.style.padding = '8px 16px';
        downloadBtn.style.fontSize = '0.82rem';
        downloadBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Download Photo
        `;
        downloadBtn.onclick = async (e) => {
          e.stopPropagation();
          try {
            downloadBtn.disabled = true;
            const signedUrl = await getSignedSelfieUrl(entry.selfie_url);
            if (signedUrl) {
              try {
                const response = await fetch(signedUrl);
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                const filename = entry.selfie_url.split('/').pop() || 'selfie.jpg';
                
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(blobUrl);
              } catch (fetchErr) {
                console.error('Fetch download failed, falling back to tab:', fetchErr);
                window.open(signedUrl, '_blank');
              }
            } else {
              alert('Could not download image.');
            }
          } catch (err) {
            console.error(err);
          } finally {
            downloadBtn.disabled = false;
          }
        };
        modalActions.appendChild(downloadBtn);
      }

      // 2. Replace Submission button
      if (entry.status === 'rejected' && entry.reupload_attempts < 3) {
        const replaceBtn = document.createElement('button');
        replaceBtn.className = 'btn-replace btn-action-pill';
        replaceBtn.textContent = `Replace Submission (${entry.reupload_attempts}/3)`;
        replaceBtn.onclick = () => {
          modal.style.display = 'none';
          triggerReplaceAction(entry);
        };
        modalActions.appendChild(replaceBtn);
      }

      // 3. Edit Details button
      if (entry.status === 'pending') {
        const editBtn = document.createElement('button');
        editBtn.className = 'btn-edit btn-action-pill';
        editBtn.textContent = 'Edit Details';
        editBtn.onclick = () => {
          modal.style.display = 'none';
          triggerEditAction(entry);
        };
        modalActions.appendChild(editBtn);
      }

      // 4. Delete Entry button (red action pill)
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-delete-individual btn-action-pill danger';
      deleteBtn.textContent = 'Delete Entry';
      deleteBtn.onclick = async () => {
        const confirmed = await showConfirm(
          'Are you sure you want to delete this guestbook entry permanently? This action is irreversible.',
          'Delete Entry'
        );
        if (!confirmed) return;

        try {
          deleteBtn.disabled = true;
          deleteBtn.textContent = 'Deleting...';
          await deleteGuestbookEntry(entry.id, entry.selfie_url);
          modal.style.display = 'none';
          alert('Entry deleted successfully.');
          await loadUserDashboard();
        } catch (err: any) {
          console.error(err);
          alert(`Failed to delete entry: ${err.message || 'Database error'}`);
          deleteBtn.disabled = false;
          deleteBtn.textContent = 'Delete Entry';
        }
      };
      modalActions.appendChild(deleteBtn);

    } else {
      // Public view context: only show download if approved and selfie exists
      if (entry.status === 'approved' && entry.selfie_url) {
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn-download btn-text-action';
        downloadBtn.style.padding = '8px 16px';
        downloadBtn.style.fontSize = '0.82rem';
        downloadBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Download Photo
        `;
        downloadBtn.onclick = async (e) => {
          e.stopPropagation();
          try {
            downloadBtn.disabled = true;
            const signedUrl = await getSignedSelfieUrl(entry.selfie_url);
            if (signedUrl) {
              try {
                const response = await fetch(signedUrl);
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                const filename = entry.selfie_url.split('/').pop() || 'selfie.jpg';
                
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(blobUrl);
              } catch (fetchErr) {
                console.error('Fetch download failed, falling back to tab:', fetchErr);
                window.open(signedUrl, '_blank');
              }
            } else {
              alert('Could not download image.');
            }
          } catch (err) {
            console.error(err);
          } finally {
            downloadBtn.disabled = false;
          }
        };
        modalActions.appendChild(downloadBtn);
      }
    }
  }

  // Handle image loading
  if (modalImg && modalSpinner) {
    modalImg.style.display = 'none';
    if (entry.selfie_url) {
      modalSpinner.style.display = 'block';
      try {
        const signedUrl = await getSignedSelfieUrl(entry.selfie_url);
        if (signedUrl) {
          modalImg.src = signedUrl;
          modalImg.onload = () => {
            modalSpinner.style.display = 'none';
            modalImg.style.display = 'block';
          };
        } else {
          modalSpinner.style.display = 'none';
        }
      } catch (err) {
        console.error('Failed to load signed URL in modal:', err);
        modalSpinner.style.display = 'none';
      }
    } else {
      modalSpinner.style.display = 'none';
      modalImg.src = '';
    }
  }

  modal.style.display = 'flex';
}

/**
 * Creates the DOM element for a single public guestbook entry card.
 */
function createPublicEntryCard(entry: any): HTMLElement {
  const card = document.createElement('div');
  card.className = 'entry-card glass-hover animate-fade-in';
  card.style.cursor = 'pointer';
  
  const dateOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  const formattedDate = new Date(entry.created_at).toLocaleDateString(undefined, dateOptions);

  card.innerHTML = `
    <div class="entry-card-header">
      <div class="entry-user-info">
        <span class="entry-name">${escapeHtml(entry.original_name)}</span>
        <span class="entry-date">${formattedDate}</span>
      </div>
    </div>
    
    <div class="entry-card-body" style="flex-grow: 1;">
      ${entry.selfie_url ? `
        <div class="entry-selfie-frame">
          <div class="selfie-loader-spinner"></div>
          <img class="entry-selfie" alt="Selfie Memory" style="display: none;" />
        </div>
      ` : `
        <div class="entry-selfie-frame" style="display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.02); min-height: 120px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.3;">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          <span style="font-size: 0.82rem; opacity: 0.4; margin-left: 8px;">Text memory</span>
        </div>
      `}
    </div>
  `;
  return card;
}

// Initialize memory detail modal close actions
const detailModal = document.getElementById('memory-detail-modal');
const closeDetailModalBtn = document.getElementById('btn-close-memory-modal');
if (closeDetailModalBtn && detailModal) {
  closeDetailModalBtn.addEventListener('click', () => {
    detailModal.style.display = 'none';
  });
  detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) {
      detailModal.style.display = 'none';
    }
  });
}

export {
  showView,
  updateNavigation,
  loadUserDashboard,
  loadAdminDashboard,
  renderAdminAllTab,
  exportAdminEntriesToCSV,
  cachedLimits,
  renderPublicFeed,
  goBack
};
