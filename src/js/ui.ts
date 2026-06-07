import { hasValidConfig } from './db/supabaseClient';

/**
 * Hides all main view sections and shows only the targeted view.
 */
function showView(viewName: 'welcome' | 'login' | 'dashboard', user?: any) {
  const welcomeSection = document.getElementById('hero-welcome');
  const loginSection = document.getElementById('login-panel');
  const dashboardSection = document.getElementById('dashboard-panel');

  if (welcomeSection) welcomeSection.style.display = 'none';
  if (loginSection) loginSection.style.display = 'none';
  if (dashboardSection) dashboardSection.style.display = 'none';

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

export {
  showView,
  updateNavigation
};
