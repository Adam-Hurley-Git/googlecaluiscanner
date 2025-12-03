/**
 * Background Service Worker
 * Handles OAuth and API calls to Google Calendar & Tasks
 */

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';
const TASKS_API_BASE = 'https://www.googleapis.com/tasks/v1';

let cachedToken = null;
let tokenExpiryTime = null;

console.log('📡 Background script loaded');

/**
 * Get OAuth token
 */
async function getAuthToken(interactive = false) {
  try {
    // Check if we have a valid cached token
    if (cachedToken && tokenExpiryTime && Date.now() < tokenExpiryTime) {
      console.log('Using cached token');
      return cachedToken;
    }

    // Get a new token
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive }, (token) => {
        if (chrome.runtime.lastError) {
          console.error('Auth error:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }

        if (!token) {
          reject(new Error('No token received'));
          return;
        }

        // Cache the token (valid for ~1 hour)
        cachedToken = token;
        tokenExpiryTime = Date.now() + (55 * 60 * 1000); // 55 minutes

        console.log('✅ Token obtained');
        resolve(token);
      });
    });
  } catch (error) {
    console.error('Failed to get auth token:', error);
    throw error;
  }
}

/**
 * Remove cached token (for re-authentication)
 */
function removeCachedToken() {
  if (cachedToken) {
    chrome.identity.removeCachedAuthToken({ token: cachedToken }, () => {
      console.log('Token removed from cache');
    });
  }
  cachedToken = null;
  tokenExpiryTime = null;
}

/**
 * Make authenticated API request
 */
async function apiRequest(url, options = {}) {
  const token = await getAuthToken(true);

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('API request failed:', response.status, errorText);

    // If unauthorized, clear token and retry once
    if (response.status === 401 && cachedToken) {
      console.log('Token expired, removing and retrying...');
      removeCachedToken();
      return apiRequest(url, options); // Retry once
    }

    throw new Error(`API request failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

/**
 * Fetch Calendar events
 */
async function fetchCalendarEvents(visibleRange) {
  console.log('📅 Fetching calendar events...', visibleRange);

  try {
    // Build time parameters - ensure valid dates
    let timeMin, timeMax;

    if (visibleRange?.startDateISO && visibleRange.startDateISO !== 'null') {
      // Parse and validate the date
      const startDate = new Date(visibleRange.startDateISO);
      if (!isNaN(startDate.getTime())) {
        timeMin = startDate.toISOString();
      }
    }

    if (visibleRange?.endDateISO && visibleRange.endDateISO !== 'null') {
      // Parse and validate the date
      const endDate = new Date(visibleRange.endDateISO);
      if (!isNaN(endDate.getTime())) {
        endDate.setDate(endDate.getDate() + 1); // Make it exclusive
        timeMax = endDate.toISOString();
      }
    }

    // Fallback to sensible defaults if dates not detected
    if (!timeMin) {
      const now = new Date();
      now.setDate(now.getDate() - 7); // Start 7 days ago
      timeMin = now.toISOString();
      console.log('Using default timeMin (7 days ago)');
    }

    if (!timeMax) {
      const end = new Date();
      end.setDate(end.getDate() + 30); // End 30 days from now
      timeMax = end.toISOString();
      console.log('Using default timeMax (30 days ahead)');
    }

    console.log('Fetching events:', { timeMin, timeMax });

    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250'
    });

    const url = `${CALENDAR_API_BASE}/calendars/primary/events?${params.toString()}`;

    console.log('API URL:', url);

    const data = await apiRequest(url);

    console.log(`✅ Found ${data.items?.length || 0} calendar events`);

    return data.items || [];
  } catch (error) {
    console.error('Failed to fetch calendar events:', error);
    throw error;
  }
}

/**
 * Fetch Google Tasks
 */
async function fetchTasks(visibleRange) {
  console.log('✅ Fetching tasks...', visibleRange);

  try {
    // First, get all task lists
    const taskListsUrl = `${TASKS_API_BASE}/users/@me/lists`;
    const taskListsData = await apiRequest(taskListsUrl);

    console.log(`Found ${taskListsData.items?.length || 0} task lists`);

    if (!taskListsData.items || taskListsData.items.length === 0) {
      return [];
    }

    // Fetch tasks from each list
    const allTasks = [];

    for (const taskList of taskListsData.items) {
      try {
        const tasksUrl = `${TASKS_API_BASE}/lists/${taskList.id}/tasks?` + new URLSearchParams({
          showCompleted: 'true',
          showHidden: 'true',
          maxResults: '100'
        });

        const tasksData = await apiRequest(tasksUrl);

        if (tasksData.items) {
          // Add taskListId and taskListTitle to each task
          tasksData.items.forEach(task => {
            task.taskListId = taskList.id;
            task.taskListTitle = taskList.title;

            // Filter by date range if specified
            if (visibleRange.startDateISO && visibleRange.endDateISO) {
              if (task.due) {
                const dueDate = task.due.substring(0, 10); // Get YYYY-MM-DD
                if (dueDate >= visibleRange.startDateISO && dueDate <= visibleRange.endDateISO) {
                  allTasks.push(task);
                }
              }
            } else {
              // If no range specified, include all tasks
              allTasks.push(task);
            }
          });
        }
      } catch (error) {
        console.error(`Failed to fetch tasks from list ${taskList.title}:`, error);
      }
    }

    console.log(`✅ Found ${allTasks.length} total tasks`);

    return allTasks;
  } catch (error) {
    console.error('Failed to fetch tasks:', error);
    throw error;
  }
}

/**
 * Handle messages from content script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Background received message:', message.type);

  switch (message.type) {
    case 'FETCH_API_DATA':
      handleFetchAPIData(message.payload, sendResponse);
      return true; // Keep channel open for async response

    case 'GET_AUTH_STATUS':
      handleGetAuthStatus(sendResponse);
      return true;

    case 'CLEAR_AUTH':
      removeCachedToken();
      sendResponse({ success: true });
      return true;

    default:
      console.warn('Unknown message type:', message.type);
      sendResponse({ error: 'Unknown message type' });
  }

  return false;
});

/**
 * Handle FETCH_API_DATA request
 */
async function handleFetchAPIData(payload, sendResponse) {
  try {
    console.log('Fetching API data for range:', payload.visibleRange);

    // Fetch both events and tasks in parallel
    const [events, tasks] = await Promise.all([
      fetchCalendarEvents(payload.visibleRange),
      fetchTasks(payload.visibleRange)
    ]);

    const response = {
      data: {
        events,
        tasks,
        fetchedAt: new Date().toISOString(),
        visibleRange: payload.visibleRange
      }
    };

    console.log('✅ API data fetched successfully');
    sendResponse(response);
  } catch (error) {
    console.error('Error fetching API data:', error);
    sendResponse({
      error: error.message || 'Failed to fetch API data',
      details: error.toString()
    });
  }
}

/**
 * Handle GET_AUTH_STATUS request
 */
async function handleGetAuthStatus(sendResponse) {
  try {
    // Try to get token non-interactively
    const token = await getAuthToken(false);
    sendResponse({
      authenticated: !!token,
      hasToken: !!cachedToken
    });
  } catch (error) {
    sendResponse({
      authenticated: false,
      hasToken: false,
      error: error.message
    });
  }
}

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed:', details.reason);

  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.local.set({
      inspectorMode: false
    });

    // Open welcome page or instructions
    console.log('Welcome! Please configure OAuth credentials in manifest.json');
  }
});

/**
 * Handle extension icon click
 */
chrome.action.onClicked.addListener((tab) => {
  console.log('Extension icon clicked');

  // Toggle inspector mode
  chrome.storage.local.get(['inspectorMode'], (result) => {
    const newMode = !result.inspectorMode;
    chrome.storage.local.set({ inspectorMode: newMode });
    console.log(`Inspector mode: ${newMode ? 'ON' : 'OFF'}`);
  });
});
