/**
 * Popup UI Script
 * Controls for the inspector extension
 */

let inspectorMode = false;

// DOM elements
const toggleBtn = document.getElementById('toggleBtn');
const clearAuthBtn = document.getElementById('clearAuthBtn');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const authStatusText = document.getElementById('authStatusText');
const setupLink = document.getElementById('setupLink');

/**
 * Initialize popup
 */
async function init() {
  // Load current inspector mode
  chrome.storage.local.get(['inspectorMode'], (result) => {
    inspectorMode = result.inspectorMode || false;
    updateUI();
  });

  // Check auth status
  checkAuthStatus();

  // Attach event listeners
  toggleBtn.addEventListener('click', toggleInspectorMode);
  clearAuthBtn.addEventListener('click', clearAuth);
  setupLink.addEventListener('click', openSetupGuide);
}

/**
 * Toggle inspector mode
 */
function toggleInspectorMode() {
  inspectorMode = !inspectorMode;

  chrome.storage.local.set({ inspectorMode }, () => {
    console.log(`Inspector mode: ${inspectorMode ? 'ON' : 'OFF'}`);
    updateUI();

    // Notify content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url.includes('calendar.google.com')) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'TOGGLE_INSPECTOR'
        });
      }
    });
  });
}

/**
 * Update UI based on current state
 */
function updateUI() {
  if (inspectorMode) {
    statusIndicator.classList.remove('inactive');
    statusIndicator.classList.add('active');
    statusText.textContent = 'Inspector Mode: ON';
    toggleBtn.textContent = 'Disable Inspector';
    toggleBtn.classList.remove('primary');
    toggleBtn.classList.add('danger');
  } else {
    statusIndicator.classList.remove('active');
    statusIndicator.classList.add('inactive');
    statusText.textContent = 'Inspector Mode: OFF';
    toggleBtn.textContent = 'Enable Inspector';
    toggleBtn.classList.remove('danger');
    toggleBtn.classList.add('primary');
  }
}

/**
 * Check authentication status
 */
async function checkAuthStatus() {
  try {
    chrome.runtime.sendMessage({ type: 'GET_AUTH_STATUS' }, (response) => {
      if (chrome.runtime.lastError) {
        authStatusText.textContent = 'Auth: Error';
        authStatusText.style.color = '#f87171';
        return;
      }

      if (response.authenticated) {
        authStatusText.textContent = '✅ Auth: Connected';
        authStatusText.style.color = '#4ade80';
      } else {
        authStatusText.textContent = '⚠️ Auth: Not configured';
        authStatusText.style.color = '#fbbf24';
      }
    });
  } catch (error) {
    console.error('Error checking auth:', error);
    authStatusText.textContent = 'Auth: Error';
    authStatusText.style.color = '#f87171';
  }
}

/**
 * Clear authentication cache
 */
function clearAuth() {
  chrome.runtime.sendMessage({ type: 'CLEAR_AUTH' }, (response) => {
    if (response.success) {
      authStatusText.textContent = '🔄 Auth cache cleared';
      authStatusText.style.color = '#fbbf24';

      setTimeout(() => {
        checkAuthStatus();
      }, 1000);
    }
  });
}

/**
 * Open setup guide
 */
function openSetupGuide(e) {
  e.preventDefault();

  // Try to open README or setup guide
  chrome.tabs.create({
    url: 'https://github.com/anthropics/googlecaluiscanner#oauth-setup'
  });
}

// Initialize when popup loads
init();
