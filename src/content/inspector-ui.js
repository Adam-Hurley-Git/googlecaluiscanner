/**
 * Visual Inspector UI
 * Provides visual feedback and controls for the scanner
 */

const InspectorUI = {
  panel: null,
  isActive: false,
  highlightedElement: null,
  currentScanResult: null,

  /**
   * Initialize the inspector UI
   */
  init() {
    console.log('🎨 Initializing Inspector UI...');
    this.createPanel();
    this.attachEventListeners();
  },

  /**
   * Create the floating inspector panel
   */
  createPanel() {
    if (this.panel) return;

    const panel = document.createElement('div');
    panel.id = 'cal-inspector-panel';
    panel.innerHTML = `
      <div class="cal-inspector-header">
        <h3>📊 Calendar Inspector</h3>
        <button id="cal-inspector-minimize">−</button>
      </div>
      <div class="cal-inspector-body">
        <div class="cal-inspector-status">
          <span id="cal-inspector-status-text">Idle</span>
        </div>

        <div class="cal-inspector-date-inputs">
          <label>
            <strong>📅 Date Range (optional):</strong>
          </label>
          <div class="date-input-row">
            <input type="date" id="cal-inspector-start-date" placeholder="Start Date" />
            <span>to</span>
            <input type="date" id="cal-inspector-end-date" placeholder="End Date" />
          </div>
          <small>Leave empty for auto-detection</small>
        </div>

        <div class="cal-inspector-controls">
          <button id="cal-inspector-scan" class="cal-btn cal-btn-primary">
            🔍 Scan DOM
          </button>
          <button id="cal-inspector-fetch-api" class="cal-btn cal-btn-secondary">
            📡 Fetch API Data
          </button>
        </div>

        <div class="cal-inspector-stats" id="cal-inspector-stats">
          <p>No scan data yet</p>
        </div>

        <div class="cal-inspector-actions">
          <button id="cal-inspector-export-scan" class="cal-btn" disabled>
            💾 Export Scan JSON
          </button>
          <button id="cal-inspector-export-api" class="cal-btn" disabled>
            💾 Export API JSON
          </button>
          <button id="cal-inspector-highlight" class="cal-btn">
            ✨ Toggle Highlights
          </button>
        </div>

        <div class="cal-inspector-help">
          <details>
            <summary>ℹ️ How to use</summary>
            <ul>
              <li><strong>Scan DOM:</strong> Extract all visual cards from the page</li>
              <li><strong>Fetch API:</strong> Get Calendar & Tasks API data</li>
              <li><strong>Export:</strong> Download JSON files for analysis</li>
              <li><strong>Click cards:</strong> Inspect individual elements</li>
            </ul>
          </details>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    this.panel = panel;

    // Make it draggable
    this.makeDraggable(panel);
  },

  /**
   * Attach event listeners to UI controls
   */
  attachEventListeners() {
    // Scan button
    document.getElementById('cal-inspector-scan')?.addEventListener('click', () => {
      this.performScan();
    });

    // Fetch API button
    document.getElementById('cal-inspector-fetch-api')?.addEventListener('click', () => {
      this.fetchAPIData();
    });

    // Export buttons
    document.getElementById('cal-inspector-export-scan')?.addEventListener('click', () => {
      if (this.currentScanResult) {
        CalendarScanner.exportScanResults(this.currentScanResult);
      }
    });

    document.getElementById('cal-inspector-export-api')?.addEventListener('click', () => {
      if (window.CAL_API_DATA) {
        this.exportAPIData(window.CAL_API_DATA);
      }
    });

    // Highlight toggle
    document.getElementById('cal-inspector-highlight')?.addEventListener('click', () => {
      this.toggleHighlights();
    });

    // Minimize button
    document.getElementById('cal-inspector-minimize')?.addEventListener('click', () => {
      this.panel.classList.toggle('minimized');
    });

    // Click on cards to inspect
    document.addEventListener('click', (e) => {
      if (this.isActive && !this.panel.contains(e.target)) {
        this.inspectElement(e.target);
      }
    }, true);
  },

  /**
   * Perform a DOM scan
   */
  performScan() {
    this.setStatus('Scanning...', 'loading');

    try {
      this.currentScanResult = CalendarScanner.scan();

      // Log to console
      console.log('📊 Scan Results:', this.currentScanResult);
      console.table(this.currentScanResult.cards.map((card, i) => ({
        index: i,
        text: card.visualTarget.textContent?.substring(0, 50),
        classes: card.visualTarget.classList.slice(0, 3).join(', '),
        hasDataEventId: !!card.visualTarget.attributes['data-eventid'],
        parentCount: card.parents.length,
        childCount: card.children.length
      })));

      // Update UI
      this.updateStats(this.currentScanResult);
      this.setStatus(`Found ${this.currentScanResult.cards.length} cards`, 'success');

      // Enable export button
      document.getElementById('cal-inspector-export-scan').disabled = false;

      // Store globally for console access
      window.CAL_SCAN_DATA = this.currentScanResult;
      console.log('💡 Scan data available at: window.CAL_SCAN_DATA');

    } catch (error) {
      console.error('Scan error:', error);
      this.setStatus('Scan failed', 'error');
    }
  },

  /**
   * Fetch API data via background script
   */
  fetchAPIData() {
    this.setStatus('Fetching API data...', 'loading');

    // Get manual date inputs
    const startDateInput = document.getElementById('cal-inspector-start-date');
    const endDateInput = document.getElementById('cal-inspector-end-date');

    let visibleRange;

    // Use manual dates if provided, otherwise use scan result or allow scan-less API fetch
    if (startDateInput?.value || endDateInput?.value) {
      visibleRange = {
        startDateISO: startDateInput.value || null,
        endDateISO: endDateInput.value || null,
        viewType: 'manual',
        detected: true
      };
      console.log('Using manual date range:', visibleRange);
    } else if (this.currentScanResult) {
      visibleRange = this.currentScanResult.visibleRange;
      console.log('Using auto-detected date range:', visibleRange);
    } else {
      // Allow API fetch without scan - will use defaults in background script
      visibleRange = {
        startDateISO: null,
        endDateISO: null,
        viewType: 'default',
        detected: false
      };
      console.log('No dates specified, using API defaults');
    }

    // Send message to background script
    chrome.runtime.sendMessage({
      type: 'FETCH_API_DATA',
      payload: {
        visibleRange: visibleRange
      }
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('API fetch error:', chrome.runtime.lastError);
        this.setStatus('API fetch failed', 'error');
        return;
      }

      if (response.error) {
        console.error('API error:', response.error);
        this.setStatus(`API error: ${response.error}`, 'error');
        return;
      }

      // Store API data
      window.CAL_API_DATA = response.data;
      console.log('📡 API Data:', response.data);
      console.log('💡 API data available at: window.CAL_API_DATA');

      // Log summary tables
      if (response.data.events) {
        console.log(`📅 Found ${response.data.events.length} events`);
        console.table(response.data.events.map(e => ({
          id: e.id,
          summary: e.summary,
          start: e.start.dateTime || e.start.date,
          colorId: e.colorId
        })));
      }

      if (response.data.tasks) {
        console.log(`✅ Found ${response.data.tasks.length} tasks`);
        console.table(response.data.tasks.map(t => ({
          id: t.id,
          title: t.title,
          due: t.due,
          status: t.status
        })));
      }

      this.setStatus(`API: ${response.data.events?.length || 0} events, ${response.data.tasks?.length || 0} tasks`, 'success');

      // Enable export button
      document.getElementById('cal-inspector-export-api').disabled = false;
    });
  },

  /**
   * Export API data as JSON
   */
  exportAPIData(apiData) {
    const dataStr = JSON.stringify(apiData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `calendar-api-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
    console.log('📥 API data exported');
  },

  /**
   * Update statistics display
   */
  updateStats(scanResult) {
    const statsEl = document.getElementById('cal-inspector-stats');
    if (!statsEl) return;

    const withEventId = scanResult.cards.filter(c =>
      c.visualTarget.attributes['data-eventid'] ||
      c.parents.some(p => p.attributes['data-eventid'])
    ).length;

    const withTaskId = scanResult.cards.filter(c =>
      c.visualTarget.attributes['data-task-id'] ||
      c.parents.some(p => p.attributes['data-task-id'])
    ).length;

    statsEl.innerHTML = `
      <p><strong>Total cards:</strong> ${scanResult.cards.length}</p>
      <p><strong>With data-eventid:</strong> ${withEventId}</p>
      <p><strong>With data-task-id:</strong> ${withTaskId}</p>
      <p><strong>View:</strong> ${scanResult.visibleRange.viewType}</p>
      <p><strong>Detected range:</strong> ${scanResult.visibleRange.startDateISO || 'none'} to ${scanResult.visibleRange.endDateISO || 'none'}</p>
    `;

    // Auto-populate date inputs with detected dates (only if empty)
    const startInput = document.getElementById('cal-inspector-start-date');
    const endInput = document.getElementById('cal-inspector-end-date');

    if (startInput && !startInput.value && scanResult.visibleRange.startDateISO) {
      startInput.value = scanResult.visibleRange.startDateISO;
    }

    if (endInput && !endInput.value && scanResult.visibleRange.endDateISO) {
      endInput.value = scanResult.visibleRange.endDateISO;
    }
  },

  /**
   * Toggle visual highlights on cards
   */
  toggleHighlights() {
    if (!this.currentScanResult) {
      alert('Please run a scan first!');
      return;
    }

    const existing = document.querySelectorAll('.cal-inspector-highlight');
    if (existing.length > 0) {
      existing.forEach(el => el.remove());
      return;
    }

    // Add highlights
    this.currentScanResult.cards.forEach((cardData, index) => {
      const targetSelector = this.reconstructSelector(cardData.visualTarget);
      const targetEl = document.evaluate(
        targetSelector,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue;

      if (targetEl) {
        const overlay = document.createElement('div');
        overlay.className = 'cal-inspector-highlight';
        overlay.style.cssText = `
          position: absolute;
          border: 2px solid #ff6b6b;
          background: rgba(255, 107, 107, 0.1);
          pointer-events: none;
          z-index: 999999;
          box-sizing: border-box;
        `;

        const rect = targetEl.getBoundingClientRect();
        overlay.style.top = `${rect.top + window.scrollY}px`;
        overlay.style.left = `${rect.left + window.scrollX}px`;
        overlay.style.width = `${rect.width}px`;
        overlay.style.height = `${rect.height}px`;

        // Add index badge
        const badge = document.createElement('div');
        badge.textContent = index;
        badge.style.cssText = `
          position: absolute;
          top: -10px;
          right: -10px;
          background: #ff6b6b;
          color: white;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: bold;
        `;
        overlay.appendChild(badge);

        document.body.appendChild(overlay);
      }
    });
  },

  /**
   * Reconstruct a selector from element data
   */
  reconstructSelector(elementData) {
    if (elementData.id) {
      return `//*[@id="${elementData.id}"]`;
    }
    return elementData.cssPath;
  },

  /**
   * Inspect a specific element when clicked
   */
  inspectElement(element) {
    // Find which card this element belongs to
    if (!this.currentScanResult) return;

    console.log('🔍 Inspecting element:', element);
    console.log('Element data:', {
      tag: element.tagName,
      id: element.id,
      classes: Array.from(element.classList),
      attributes: element.attributes,
      text: element.textContent?.substring(0, 100)
    });
  },

  /**
   * Set status message
   */
  setStatus(message, type = 'info') {
    const statusEl = document.getElementById('cal-inspector-status-text');
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = `status-${type}`;
    }
  },

  /**
   * Make panel draggable
   */
  makeDraggable(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    const header = element.querySelector('.cal-inspector-header');

    header.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      element.style.top = (element.offsetTop - pos2) + "px";
      element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
  },

  /**
   * Activate inspector
   */
  activate() {
    this.isActive = true;
    if (this.panel) {
      this.panel.style.display = 'block';
    }
  },

  /**
   * Deactivate inspector
   */
  deactivate() {
    this.isActive = false;
    if (this.panel) {
      this.panel.style.display = 'none';
    }
  }
};

// Make it globally accessible
window.InspectorUI = InspectorUI;
