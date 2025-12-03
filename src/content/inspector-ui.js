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
          <button id="cal-inspector-export-analysis" class="cal-btn cal-btn-primary" disabled>
            📊 Export Complete Analysis
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

    document.getElementById('cal-inspector-export-analysis')?.addEventListener('click', () => {
      if (this.currentScanResult && window.CAL_API_DATA) {
        this.exportCompleteAnalysis();
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

      // Enable analysis button if we have both scan and API data
      if (window.CAL_API_DATA) {
        document.getElementById('cal-inspector-export-analysis').disabled = false;
      }

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

      // Enable analysis button if we have both scan and API data
      if (this.currentScanResult) {
        document.getElementById('cal-inspector-export-analysis').disabled = false;
      }
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
   * Export complete analysis report
   */
  exportCompleteAnalysis() {
    console.log('📊 Generating complete analysis report...');

    const scanData = this.currentScanResult;
    const apiData = window.CAL_API_DATA;

    if (!scanData || !apiData) {
      alert('Please run both DOM scan and API fetch first!');
      return;
    }

    // Perform comprehensive analysis
    const analysis = this.analyzeMapping(scanData, apiData);

    // Generate the report
    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        url: window.location.href,
        totalCards: scanData.cards.length,
        totalEvents: apiData.events.length,
        totalTasks: apiData.tasks.length
      },

      summary: analysis.summary,

      mappingGuide: analysis.mappingGuide,

      cardAnalysis: analysis.cardAnalysis,

      implementationGuide: analysis.implementationGuide,

      rawData: {
        scanData: scanData,
        apiData: apiData
      }
    };

    // Export as JSON
    const dataStr = JSON.stringify(report, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `calendar-complete-analysis-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);

    // Also log the summary to console
    console.log('📊 Analysis Summary:', analysis.summary);
    console.log('🗺️ Mapping Guide:', analysis.mappingGuide);
    console.log('📥 Complete report exported');
  },

  /**
   * Analyze mapping between scan and API data
   */
  analyzeMapping(scanData, apiData) {
    const cardAnalysis = [];
    const eventPatterns = new Set();
    const taskPatterns = new Set();
    let mappedToEvents = 0;
    let mappedToTasks = 0;
    let unmapped = 0;

    // Analyze each card
    scanData.cards.forEach((card, index) => {
      const eventId = card.visualTarget.attributes['data-eventid'] ||
                     card.parents[0]?.attributes['data-eventid'] ||
                     card.parents[1]?.attributes['data-eventid'];

      const taskId = card.visualTarget.attributes['data-task-id'] ||
                    card.parents[0]?.attributes['data-task-id'];

      // Try to match to API data
      const matchedEvent = apiData.events.find(e => e.id === eventId);
      const matchedTask = apiData.tasks.find(t => t.id === eventId || t.id === taskId);

      let cardType = 'unknown';
      let mappingMethod = 'none';
      let idLocation = 'none';

      if (matchedEvent) {
        cardType = 'event';
        mappedToEvents++;
        mappingMethod = 'data-eventid';

        if (card.visualTarget.attributes['data-eventid']) {
          idLocation = 'visualTarget';
        } else if (card.parents[0]?.attributes['data-eventid']) {
          idLocation = 'parent[0]';
        } else if (card.parents[1]?.attributes['data-eventid']) {
          idLocation = 'parent[1]';
        }

        // Collect common patterns for events
        card.visualTarget.classList.forEach(cls => eventPatterns.add(cls));
      } else if (matchedTask) {
        cardType = 'task';
        mappedToTasks++;
        mappingMethod = eventId ? 'data-eventid' : 'data-task-id';

        if (card.visualTarget.attributes['data-eventid'] || card.visualTarget.attributes['data-task-id']) {
          idLocation = 'visualTarget';
        } else {
          idLocation = 'parent[0]';
        }

        // Collect common patterns for tasks
        card.visualTarget.classList.forEach(cls => taskPatterns.add(cls));
      } else {
        unmapped++;
      }

      cardAnalysis.push({
        cardIndex: index,
        cardType: cardType,
        mappingMethod: mappingMethod,
        idLocation: idLocation,
        eventId: eventId,
        taskId: taskId,
        visualTarget: {
          tagName: card.visualTarget.tagName,
          classList: card.visualTarget.classList,
          attributes: card.visualTarget.attributes,
          textContent: card.visualTarget.textContent?.substring(0, 100)
        },
        matchedData: matchedEvent || matchedTask || null
      });
    });

    // Generate summary
    const summary = {
      totalCards: scanData.cards.length,
      mappedToEvents: mappedToEvents,
      mappedToTasks: mappedToTasks,
      unmapped: unmapped,
      mappingSuccessRate: `${Math.round((mappedToEvents + mappedToTasks) / scanData.cards.length * 100)}%`
    };

    // Generate mapping guide
    const mappingGuide = {
      primaryMappingKey: 'data-eventid',
      keyLocation: this.determineMostCommonIdLocation(cardAnalysis),
      eventClasses: Array.from(eventPatterns),
      taskClasses: Array.from(taskPatterns),
      distinguishingClasses: this.findDistinguishingClasses(eventPatterns, taskPatterns),
      selectorStrategy: this.generateSelectorStrategy(cardAnalysis)
    };

    // Generate implementation guide
    const implementationGuide = this.generateImplementationGuide(mappingGuide, cardAnalysis);

    return {
      summary,
      mappingGuide,
      cardAnalysis,
      implementationGuide
    };
  },

  /**
   * Determine most common ID location
   */
  determineMostCommonIdLocation(cardAnalysis) {
    const locations = {};
    cardAnalysis.forEach(card => {
      if (card.idLocation !== 'none') {
        locations[card.idLocation] = (locations[card.idLocation] || 0) + 1;
      }
    });

    let mostCommon = 'unknown';
    let maxCount = 0;
    for (const [location, count] of Object.entries(locations)) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = location;
      }
    }

    return {
      mostCommon,
      distribution: locations
    };
  },

  /**
   * Find classes that distinguish events from tasks
   */
  findDistinguishingClasses(eventClasses, taskClasses) {
    const eventOnly = Array.from(eventClasses).filter(cls => !taskClasses.has(cls));
    const taskOnly = Array.from(taskClasses).filter(cls => !eventClasses.has(cls));
    const common = Array.from(eventClasses).filter(cls => taskClasses.has(cls));

    return {
      eventOnly,
      taskOnly,
      common
    };
  },

  /**
   * Generate selector strategy
   */
  generateSelectorStrategy(cardAnalysis) {
    const strategies = [];

    // Strategy 1: Direct data-eventid
    if (cardAnalysis.some(c => c.idLocation === 'visualTarget')) {
      strategies.push({
        name: 'Direct ID Selector',
        code: `document.querySelector('[data-eventid="${eventId}"]')`,
        description: 'Use when data-eventid is on the visual target itself'
      });
    }

    // Strategy 2: Parent has ID
    if (cardAnalysis.some(c => c.idLocation.startsWith('parent'))) {
      strategies.push({
        name: 'Parent Container Selector',
        code: `const container = document.querySelector('[data-eventid="${eventId}"]');\nconst visualTarget = container.querySelector('.event-class');`,
        description: 'Use when data-eventid is on a parent container'
      });
    }

    // Strategy 3: Class-based for events
    const eventClasses = cardAnalysis
      .filter(c => c.cardType === 'event')
      .map(c => c.visualTarget.classList[0])
      .filter((v, i, a) => a.indexOf(v) === i);

    if (eventClasses.length > 0) {
      strategies.push({
        name: 'Event Class Selector',
        code: `document.querySelectorAll('.${eventClasses[0]}')`,
        description: 'Select all events by common class'
      });
    }

    // Strategy 4: Class-based for tasks
    const taskClasses = cardAnalysis
      .filter(c => c.cardType === 'task')
      .map(c => c.visualTarget.classList[0])
      .filter((v, i, a) => a.indexOf(v) === i);

    if (taskClasses.length > 0) {
      strategies.push({
        name: 'Task Class Selector',
        code: `document.querySelectorAll('.${taskClasses[0]}')`,
        description: 'Select all tasks by common class'
      });
    }

    return strategies;
  },

  /**
   * Generate implementation guide
   */
  generateImplementationGuide(mappingGuide, cardAnalysis) {
    const guide = {
      overview: `This calendar uses '${mappingGuide.primaryMappingKey}' as the primary identifier for both events and tasks. ` +
                `The ID is typically found on ${mappingGuide.keyLocation.mostCommon}.`,

      coloringFunction: this.generateColoringFunction(mappingGuide, cardAnalysis),

      exampleUsage: this.generateExampleUsage(cardAnalysis),

      distinguishingFeatures: {
        events: {
          classes: mappingGuide.distinguishingClasses.eventOnly,
          attributes: this.getCommonAttributes(cardAnalysis.filter(c => c.cardType === 'event'))
        },
        tasks: {
          classes: mappingGuide.distinguishingClasses.taskOnly,
          attributes: this.getCommonAttributes(cardAnalysis.filter(c => c.cardType === 'task'))
        }
      },

      recommendations: [
        `Primary mapping key: ${mappingGuide.primaryMappingKey}`,
        `ID location: ${mappingGuide.keyLocation.mostCommon}`,
        `Success rate: ${Math.round(cardAnalysis.filter(c => c.cardType !== 'unknown').length / cardAnalysis.length * 100)}%`,
        `Total mappable cards: ${cardAnalysis.filter(c => c.cardType !== 'unknown').length} / ${cardAnalysis.length}`
      ]
    };

    return guide;
  },

  /**
   * Generate coloring function code
   */
  generateColoringFunction(mappingGuide, cardAnalysis) {
    const sampleCard = cardAnalysis.find(c => c.cardType === 'event');

    return {
      javascript: `
// Function to color a calendar card by event ID
function colorCalendarCard(eventId, color) {
  // Find element with data-eventid
  const element = document.querySelector(\`[data-eventid="\${eventId}"]\`);

  if (element) {
    // Apply color to the visual target
    element.style.backgroundColor = color;
    element.style.borderLeft = \`4px solid \${color}\`;
    return true;
  }

  return false;
}

// Batch color multiple events
function colorMultipleEvents(eventColorMap) {
  let successCount = 0;

  for (const [eventId, color] of Object.entries(eventColorMap)) {
    if (colorCalendarCard(eventId, color)) {
      successCount++;
    }
  }

  console.log(\`Colored \${successCount} events\`);
  return successCount;
}

// Example: Color by event type
async function applyEventColors() {
  // Fetch events from API
  const events = await fetchCalendarEvents();

  events.forEach(event => {
    let color;

    if (event.summary.includes('Meeting')) {
      color = '#ff6b6b';
    } else if (event.summary.includes('Work')) {
      color = '#4ecdc4';
    } else if (event.colorId === '1') {
      color = '#a8dadc';
    } else {
      color = '#f1faee';
    }

    colorCalendarCard(event.id, color);
  });
}
      `.trim(),

      usage: 'Call colorCalendarCard(eventId, color) for each event you want to color'
    };
  },

  /**
   * Generate example usage
   */
  generateExampleUsage(cardAnalysis) {
    const sampleEvent = cardAnalysis.find(c => c.cardType === 'event');
    const sampleTask = cardAnalysis.find(c => c.cardType === 'task');

    return {
      colorSingleEvent: sampleEvent ? `colorCalendarCard('${sampleEvent.eventId}', '#ff6b6b')` : 'N/A',
      colorSingleTask: sampleTask ? `colorCalendarCard('${sampleTask.eventId}', '#4ecdc4')` : 'N/A',
      batchColor: `colorMultipleEvents({ 'event1_id': '#ff6b6b', 'event2_id': '#4ecdc4' })`
    };
  },

  /**
   * Get common attributes
   */
  getCommonAttributes(cards) {
    const attrCounts = {};

    cards.forEach(card => {
      Object.keys(card.visualTarget.attributes || {}).forEach(attr => {
        attrCounts[attr] = (attrCounts[attr] || 0) + 1;
      });
    });

    // Return attributes present in >50% of cards
    const threshold = cards.length * 0.5;
    return Object.keys(attrCounts).filter(attr => attrCounts[attr] > threshold);
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

    console.log('Adding visual highlights to cards...');

    // Add highlights
    this.currentScanResult.cards.forEach((cardData, index) => {
      try {
        // Try to find the element directly using classes and attributes
        let targetEl = null;

        // Strategy 1: Try by ID if it exists
        if (cardData.visualTarget.id) {
          targetEl = document.getElementById(cardData.visualTarget.id);
        }

        // Strategy 2: Try by data-eventid
        if (!targetEl) {
          const eventId = cardData.visualTarget.attributes['data-eventid'] ||
                         cardData.parents[0]?.attributes['data-eventid'] ||
                         cardData.parents[1]?.attributes['data-eventid'];
          if (eventId) {
            targetEl = document.querySelector(`[data-eventid="${eventId}"]`);
          }
        }

        // Strategy 3: Use bounding box to find element at that position
        if (!targetEl && cardData.visualTarget.rect) {
          const rect = cardData.visualTarget.rect;
          targetEl = document.elementFromPoint(rect.x + 10, rect.y + 10);
        }

        if (targetEl) {
          // Determine if this card has an event ID
          const hasEventId = !!(
            cardData.visualTarget.attributes['data-eventid'] ||
            cardData.parents.some(p => p.attributes && p.attributes['data-eventid'])
          );

          const hasTaskId = !!(
            cardData.visualTarget.attributes['data-task-id'] ||
            cardData.parents.some(p => p.attributes && p.attributes['data-task-id'])
          );

          // Color code: green if has ID, red if no ID
          let borderColor, bgColor, badgeColor, label;
          if (hasEventId) {
            borderColor = '#4ade80';
            bgColor = 'rgba(74, 222, 128, 0.15)';
            badgeColor = '#22c55e';
            label = 'E';
          } else if (hasTaskId) {
            borderColor = '#60a5fa';
            bgColor = 'rgba(96, 165, 250, 0.15)';
            badgeColor = '#3b82f6';
            label = 'T';
          } else {
            borderColor = '#ff6b6b';
            bgColor = 'rgba(255, 107, 107, 0.15)';
            badgeColor = '#ef4444';
            label = '?';
          }

          const overlay = document.createElement('div');
          overlay.className = 'cal-inspector-highlight';
          overlay.style.cssText = `
            position: absolute;
            border: 3px solid ${borderColor};
            background: ${bgColor};
            pointer-events: none;
            z-index: 999999;
            box-sizing: border-box;
            transition: all 0.2s;
          `;

          const rect = targetEl.getBoundingClientRect();
          overlay.style.top = `${rect.top + window.scrollY}px`;
          overlay.style.left = `${rect.left + window.scrollX}px`;
          overlay.style.width = `${rect.width}px`;
          overlay.style.height = `${rect.height}px`;

          // Add badge with index and type
          const badge = document.createElement('div');
          badge.textContent = `${index}`;
          badge.style.cssText = `
            position: absolute;
            top: -12px;
            right: -12px;
            background: ${badgeColor};
            color: white;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: bold;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          `;
          overlay.appendChild(badge);

          // Add type label
          const typeLabel = document.createElement('div');
          typeLabel.textContent = label;
          typeLabel.style.cssText = `
            position: absolute;
            top: -12px;
            left: -12px;
            background: ${badgeColor};
            color: white;
            border-radius: 4px;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: bold;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          `;
          overlay.appendChild(typeLabel);

          // Add tooltip on hover (visible through pointer-events on tooltip)
          const tooltip = document.createElement('div');
          const eventId = cardData.visualTarget.attributes['data-eventid'] ||
                         cardData.parents[0]?.attributes['data-eventid'] ||
                         cardData.parents[1]?.attributes['data-eventid'];

          tooltip.innerHTML = `
            <strong>Card #${index}</strong><br>
            ${cardData.visualTarget.textContent?.substring(0, 50) || 'No text'}<br>
            ${eventId ? `ID: ${eventId.substring(0, 20)}...` : 'No ID found'}
          `;
          tooltip.style.cssText = `
            position: absolute;
            bottom: 105%;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 11px;
            white-space: nowrap;
            opacity: 0;
            pointer-events: auto;
            transition: opacity 0.2s;
            z-index: 1000000;
            line-height: 1.4;
          `;
          overlay.appendChild(tooltip);

          // Show tooltip on hover
          overlay.addEventListener('mouseenter', () => {
            tooltip.style.opacity = '1';
          });
          overlay.addEventListener('mouseleave', () => {
            tooltip.style.opacity = '0';
          });
          overlay.style.pointerEvents = 'auto';
          overlay.style.cursor = 'help';

          document.body.appendChild(overlay);
          console.log(`Highlighted card #${index}:`, hasEventId ? 'HAS EVENT ID' : 'NO EVENT ID');
        } else {
          console.warn(`Could not find element for card #${index}`);
        }
      } catch (error) {
        console.error(`Error highlighting card #${index}:`, error);
      }
    });

    console.log('✨ Highlights added! Hover over cards to see details.');
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
