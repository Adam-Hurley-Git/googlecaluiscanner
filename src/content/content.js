/**
 * Main Content Script
 * Orchestrates scanner and inspector UI
 */

(function() {
  'use strict';

  let inspectorMode = false;

  console.log('📦 Calendar-Tasks Mapping Inspector loaded');

  /**
   * Initialize the inspector
   */
  function init() {
    // Wait for page to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }

    // Check if we're on Google Calendar
    if (!window.location.hostname.includes('calendar.google.com')) {
      console.log('Not on Google Calendar, inspector inactive');
      return;
    }

    // Get inspector mode state from storage
    chrome.storage.local.get(['inspectorMode'], (result) => {
      inspectorMode = result.inspectorMode || false;

      if (inspectorMode) {
        activateInspector();
      }

      console.log(`Inspector mode: ${inspectorMode ? 'ON' : 'OFF'}`);
    });

    // Listen for mode changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.inspectorMode) {
        inspectorMode = changes.inspectorMode.newValue;

        if (inspectorMode) {
          activateInspector();
        } else {
          deactivateInspector();
        }
      }
    });

    // Add keyboard shortcut: Ctrl+Shift+I
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        toggleInspectorMode();
      }
    });
  }

  /**
   * Activate the inspector
   */
  function activateInspector() {
    console.log('✅ Activating inspector...');

    // Initialize UI if not already done
    if (!window.InspectorUI.panel) {
      InspectorUI.init();
    }

    InspectorUI.activate();

    // Add global helper functions
    window.scanCalendar = () => {
      const result = CalendarScanner.scan();
      console.log('Scan result:', result);
      return result;
    };

    window.exportScan = () => {
      const result = CalendarScanner.scan();
      CalendarScanner.exportScanResults(result);
    };

    console.log('💡 Quick commands:');
    console.log('  - scanCalendar() - Run a scan');
    console.log('  - exportScan() - Scan and export');
    console.log('  - window.CAL_SCAN_DATA - Last scan results');
    console.log('  - window.CAL_API_DATA - Last API results');
  }

  /**
   * Deactivate the inspector
   */
  function deactivateInspector() {
    console.log('❌ Deactivating inspector...');
    InspectorUI.deactivate();

    // Remove highlights
    document.querySelectorAll('.cal-inspector-highlight').forEach(el => el.remove());
  }

  /**
   * Toggle inspector mode
   */
  function toggleInspectorMode() {
    inspectorMode = !inspectorMode;
    chrome.storage.local.set({ inspectorMode });
    console.log(`Inspector mode: ${inspectorMode ? 'ON' : 'OFF'}`);
  }

  /**
   * Listen for messages from background script
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📨 Message received:', message.type);

    switch (message.type) {
      case 'PING':
        sendResponse({ status: 'ok' });
        break;

      case 'TOGGLE_INSPECTOR':
        toggleInspectorMode();
        sendResponse({ inspectorMode });
        break;

      case 'GET_SCAN_DATA':
        const scanData = CalendarScanner.scan();
        sendResponse({ data: scanData });
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }

    return true; // Keep channel open for async responses
  });

  // Initialize when script loads
  init();

})();
