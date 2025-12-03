/**
 * DOM Scanner for Google Calendar
 * Extracts all visual cards and their hierarchical context
 */

const CalendarScanner = {

  /**
   * Find all visual card elements on the calendar
   */
  findVisualCards() {
    const cards = [];

    // Multiple strategies to find cards - Google Calendar uses various selectors
    const selectors = [
      '[role="button"][data-draggable-id]',
      '[role="button"][jsname]',
      '[data-eventid]',
      '[data-chip]',
      '.event-segment',
      '[role="link"][data-eventid]',
      // Tasks might use different selectors
      '[data-task-id]',
      '[aria-label*="task" i]',
      // Generic fallback for clickable event-like elements
      '[role="button"][aria-label*="AM" i]',
      '[role="button"][aria-label*="PM" i]'
    ];

    const foundElements = new Set();

    selectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          // Only add if it's visible and has reasonable dimensions
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && this.isVisible(el)) {
            foundElements.add(el);
          }
        });
      } catch (e) {
        console.warn(`Selector failed: ${selector}`, e);
      }
    });

    return Array.from(foundElements);
  },

  /**
   * Check if element is visible
   */
  isVisible(el) {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0';
  },

  /**
   * Extract all data from an element
   */
  extractElementData(el, includeStyles = false) {
    const data = {
      tagName: el.tagName,
      id: el.id || null,
      className: el.className || null,
      classList: el.classList ? Array.from(el.classList) : [],

      // All attributes
      attributes: {},

      // Data attributes
      dataset: { ...el.dataset },

      // ARIA attributes
      ariaLabel: el.getAttribute('aria-label'),
      ariaDescribedBy: el.getAttribute('aria-describedby'),
      role: el.getAttribute('role'),

      // Content
      textContent: el.textContent?.trim().substring(0, 500),
      innerText: el.innerText?.trim().substring(0, 500),
      innerHTML: el.innerHTML?.substring(0, 1000),

      // Position and dimensions
      rect: this.getElementRect(el)
    };

    // Extract ALL attributes
    if (el.attributes) {
      for (let attr of el.attributes) {
        data.attributes[attr.name] = attr.value;
      }
    }

    // Optional: computed styles (can be verbose)
    if (includeStyles) {
      const computedStyle = window.getComputedStyle(el);
      data.computedStyles = {
        backgroundColor: computedStyle.backgroundColor,
        color: computedStyle.color,
        display: computedStyle.display,
        position: computedStyle.position,
        zIndex: computedStyle.zIndex,
        cursor: computedStyle.cursor
      };
    }

    return data;
  },

  /**
   * Get element position and dimensions
   */
  getElementRect(el) {
    const rect = el.getBoundingClientRect();
    return {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      top: Math.round(rect.top),
      left: Math.round(rect.left),
      bottom: Math.round(rect.bottom),
      right: Math.round(rect.right)
    };
  },

  /**
   * Walk up the DOM tree and extract parent context
   */
  extractParentContext(el, levels = 5) {
    const parents = [];
    let current = el.parentElement;
    let level = 1;

    while (current && level <= levels) {
      parents.push({
        level,
        ...this.extractElementData(current, false)
      });
      current = current.parentElement;
      level++;
    }

    return parents;
  },

  /**
   * Walk down the DOM tree and extract children
   */
  extractChildrenContext(el, maxDepth = 3) {
    const children = [];

    const traverse = (element, depth = 0) => {
      if (depth >= maxDepth) return;

      for (let child of element.children) {
        children.push({
          depth,
          ...this.extractElementData(child, false)
        });

        traverse(child, depth + 1);
      }
    };

    traverse(el);
    return children;
  },

  /**
   * Generate a CSS selector path for an element
   */
  getElementPath(el) {
    const path = [];
    let current = el;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break; // ID is unique, stop here
      } else if (current.className) {
        const classes = Array.from(current.classList).slice(0, 3).join('.');
        if (classes) selector += `.${classes}`;
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  },

  /**
   * Detect the visible date range from the calendar UI
   */
  detectVisibleDateRange() {
    // Try to find date headers or navigation elements
    const range = {
      startDateISO: null,
      endDateISO: null,
      viewType: null,
      detected: false
    };

    try {
      // Try to detect from URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const dates = urlParams.get('dates');
      if (dates) {
        const [start, end] = dates.split('/');
        range.startDateISO = start;
        range.endDateISO = end;
        range.detected = true;
      }

      // Try to find date elements in the UI
      const dateHeaders = document.querySelectorAll('[data-datekey], [data-date]');
      const foundDates = [];

      dateHeaders.forEach(header => {
        const dateKey = header.getAttribute('data-datekey') || header.getAttribute('data-date');
        if (dateKey) {
          foundDates.push(dateKey);
        }
      });

      if (foundDates.length > 0) {
        foundDates.sort();
        range.startDateISO = foundDates[0];
        range.endDateISO = foundDates[foundDates.length - 1];
        range.detected = true;
      }

      // Detect view type
      if (window.location.href.includes('/week')) {
        range.viewType = 'week';
      } else if (window.location.href.includes('/day')) {
        range.viewType = 'day';
      } else if (window.location.href.includes('/month')) {
        range.viewType = 'month';
      } else {
        range.viewType = 'unknown';
      }

    } catch (e) {
      console.error('Error detecting date range:', e);
    }

    return range;
  },

  /**
   * Main scan function - extracts everything
   */
  scan() {
    console.log('🔍 Starting calendar scan...');

    const scanResult = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      visibleRange: this.detectVisibleDateRange(),
      cards: []
    };

    const visualCards = this.findVisualCards();
    console.log(`Found ${visualCards.length} visual card elements`);

    visualCards.forEach((card, index) => {
      const cardData = {
        cardIndex: index,

        // The visual target (what you'd paint)
        visualTarget: {
          ...this.extractElementData(card, true),
          cssPath: this.getElementPath(card)
        },

        // Parent hierarchy (where IDs might live)
        parents: this.extractParentContext(card, 5),

        // Children (where content might be)
        children: this.extractChildrenContext(card, 3),

        // Nearby siblings (might contain related data)
        siblings: this.extractSiblings(card)
      };

      scanResult.cards.push(cardData);
    });

    console.log('✅ Scan complete');
    return scanResult;
  },

  /**
   * Extract sibling elements
   */
  extractSiblings(el) {
    const siblings = [];
    if (!el.parentElement) return siblings;

    const parent = el.parentElement;
    for (let sibling of parent.children) {
      if (sibling !== el) {
        siblings.push({
          ...this.extractElementData(sibling, false),
          position: sibling === el.previousElementSibling ? 'before' :
                    sibling === el.nextElementSibling ? 'after' : 'other'
        });
      }
    }

    return siblings.slice(0, 10); // Limit to 10 siblings
  },

  /**
   * Export scan results as JSON
   */
  exportScanResults(scanResult) {
    const dataStr = JSON.stringify(scanResult, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `calendar-scan-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
    console.log('📥 Scan results exported');
  }
};

// Make it globally accessible for debugging
window.CalendarScanner = CalendarScanner;
