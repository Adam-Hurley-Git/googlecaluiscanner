# Task Coloring Implementation Plan
## Analysis of Google Calendar UI Changes

### Executive Summary
Google Calendar's UI has been completely redesigned, breaking the previous task coloring implementation. This document provides a comprehensive analysis and implementation plan for the new UI structure.

---

## 🔍 Analysis Results

### Current State
- **Total Cards Detected**: 42
- **Successfully Mapped**: 0 (0% success rate)
- **Issue**: All previous selectors and mapping methods are broken

### Card Type Classification

Based on the analysis file `calendar-complete-analysis-1764771280664.json`, here are the identified card patterns:

#### 1. **Regular Event Cards** (11 instances)
```
Classes: ["GTG3wb", "ChfiMc", "rFUW1c", "EiZ8Dd", "afiDFd"]
Selector: .GTG3wb.EiZ8Dd
Attribute: data-eventid (contains base64-like event ID)
Visual: Main event container with time/title
```

#### 2. **Task Cards** (4 instances)
```
Classes: ["GTG3wb", "ChfiMc", "rFUW1c", "LLspoc", "afiDFd"]
        OR ["GTG3wb", "ChfiMc", "rFUW1c", "LLspoc", "F262Ye", "afiDFd"]
Selector: .GTG3wb.LLspoc
Attribute: data-eventid (starts with "ttb_")
Visual: Task container with checkbox
Distinguishing: Has "LLspoc" class (instead of "EiZ8Dd")
```

#### 3. **Task Rollover View** (1 instance)
```
Classes: ["vEJ0bc", "ChfiMc", "rFUW1c", "GHWQBd"]
Attribute: data-eventid="tasks_rollover_view"
Visual: "30 pending tasks" summary card
Purpose: Shows overflow tasks
```

#### 4. **Resize Handles** (17 instances) ⚠️ IGNORE THESE
```
Classes: ["leOeGd", "ChfiMc", "YVffPe"]
Purpose: Drag handles for resizing events
Action: These should be FILTERED OUT from coloring
```

#### 5. **Task Checkboxes** (4 instances)
```
Classes: ["bgr46c"]
Purpose: Checkbox UI element within task cards
Note: Not a primary paint target
```

---

## 🎯 Mapping Strategy

### Primary Identifier: `data-eventid`
All calendar cards have a `data-eventid` attribute that serves as the primary identifier.

### ID Format Patterns:
1. **Regular Events**: Base64-like strings
   ```
   Example: "cm51cnRpdWxvaWxsZW9lZ2w0ODE1MHVzODhfMjAyNTExMzBUMTkwMDAwWiBhZGFtLmh1cmxleS5wcml2YXRlQG0"
   ```

2. **Tasks**: Prefixed with `ttb_`
   ```
   Example: "ttb_MTVxbWhvcjNjN3Y3ZjYwcnAwdGVxMGxhazMgYWRhbS5odXJsZXkucHJpdmF0ZUBt"
   ```

3. **Task Rollover**: Special constant
   ```
   Example: "tasks_rollover_view"
   ```

### Card Type Detection Logic:
```javascript
function getCardType(element) {
  const eventId = element.getAttribute('data-eventid');
  const classList = element.classList;

  // Filter out resize handles
  if (classList.contains('leOeGd')) {
    return 'RESIZE_HANDLE'; // Ignore
  }

  // Check for task rollover
  if (eventId === 'tasks_rollover_view') {
    return 'TASK_ROLLOVER';
  }

  // Check for tasks by class
  if (classList.contains('LLspoc')) {
    return 'TASK';
  }

  // Check for tasks by ID prefix
  if (eventId && eventId.startsWith('ttb_')) {
    return 'TASK';
  }

  // Check for regular events
  if (classList.contains('EiZ8Dd')) {
    return 'EVENT';
  }

  // Default to event if has GTG3wb
  if (classList.contains('GTG3wb')) {
    return 'EVENT';
  }

  return 'UNKNOWN';
}
```

---

## 🎨 Painting Strategy

### Selectors for Painting:

#### Target Elements:
```javascript
// Primary selector for all colorable cards
const PRIMARY_SELECTOR = '[data-eventid].GTG3wb, [data-eventid].vEJ0bc';

// Task-specific selector
const TASK_SELECTOR = '[data-eventid].GTG3wb.LLspoc';

// Event-specific selector
const EVENT_SELECTOR = '[data-eventid].GTG3wb.EiZ8Dd';

// Exclude resize handles
const EXCLUDE_SELECTOR = ':not(.leOeGd)';

// Complete selector
const COMPLETE_SELECTOR = `${PRIMARY_SELECTOR}${EXCLUDE_SELECTOR}`;
```

### CSS Properties to Modify:
Based on the analysis, cards already have inline styles for `background-color` and `border-color`. We should override these:

```javascript
function paintCard(element, color) {
  // Apply background color with transparency
  element.style.backgroundColor = `${color}`;

  // Apply border color for visual emphasis
  element.style.borderColor = `${color}`;

  // Optional: Add left border for stronger emphasis
  element.style.borderLeftWidth = '4px';
  element.style.borderLeftStyle = 'solid';
  element.style.borderLeftColor = `${color}`;

  // Mark as colored for cleanup later
  element.setAttribute('data-colored-by-extension', 'true');
}
```

---

## 🏗️ Implementation Architecture

### Module Structure:

```
src/content/
├── scanner.js          # Existing scanner (minimal changes)
├── inspector-ui.js     # Existing inspector UI (no changes)
├── content.js          # Main orchestrator (add coloring activation)
├── task-coloring.js    # NEW: Core coloring logic
└── color-config.js     # NEW: Color schemes and configuration
```

### New File: `task-coloring.js`

```javascript
/**
 * Task Coloring Module for Google Calendar
 * Handles painting of tasks based on API data
 */

const TaskColoring = {
  // Configuration
  config: {
    enabled: false,
    colorMap: new Map(), // eventId -> color
    mutationObserver: null
  },

  // Selectors
  selectors: {
    primary: '[data-eventid].GTG3wb, [data-eventid].vEJ0bc',
    exclude: ':not(.leOeGd)',
    task: '.LLspoc',
    event: '.EiZ8Dd'
  },

  /**
   * Initialize the coloring system
   */
  init() {
    console.log('🎨 Initializing Task Coloring...');
    this.setupMutationObserver();
  },

  /**
   * Enable/disable coloring
   */
  setEnabled(enabled) {
    this.config.enabled = enabled;
    if (enabled) {
      this.applyColors();
      this.config.mutationObserver?.observe(document.body, {
        childList: true,
        subtree: true
      });
    } else {
      this.clearColors();
      this.config.mutationObserver?.disconnect();
    }
  },

  /**
   * Set color map from API data
   */
  setColorMap(colorMap) {
    this.config.colorMap = new Map(Object.entries(colorMap));
    if (this.config.enabled) {
      this.applyColors();
    }
  },

  /**
   * Get all colorable cards
   */
  findColorableCards() {
    const selector = `${this.selectors.primary}${this.selectors.exclude}`;
    return document.querySelectorAll(selector);
  },

  /**
   * Determine card type
   */
  getCardType(element) {
    const eventId = element.getAttribute('data-eventid');
    const classList = element.classList;

    // Filter out resize handles
    if (classList.contains('leOeGd')) {
      return 'RESIZE_HANDLE';
    }

    // Task rollover
    if (eventId === 'tasks_rollover_view') {
      return 'TASK_ROLLOVER';
    }

    // Tasks
    if (classList.contains('LLspoc') || (eventId && eventId.startsWith('ttb_'))) {
      return 'TASK';
    }

    // Events
    if (classList.contains('EiZ8Dd') || classList.contains('GTG3wb')) {
      return 'EVENT';
    }

    return 'UNKNOWN';
  },

  /**
   * Paint a single card
   */
  paintCard(element, color) {
    if (!element || !color) return false;

    // Apply background color
    element.style.backgroundColor = color;

    // Apply border color
    element.style.borderColor = color;
    element.style.borderLeftWidth = '4px';
    element.style.borderLeftStyle = 'solid';
    element.style.borderLeftColor = color;

    // Mark as colored
    element.setAttribute('data-colored-by-extension', 'true');

    return true;
  },

  /**
   * Clear paint from a card
   */
  clearCardPaint(element) {
    if (!element) return;

    element.style.backgroundColor = '';
    element.style.borderColor = '';
    element.style.borderLeftWidth = '';
    element.style.borderLeftStyle = '';
    element.style.borderLeftColor = '';
    element.removeAttribute('data-colored-by-extension');
  },

  /**
   * Apply colors to all cards
   */
  applyColors() {
    if (!this.config.enabled) return;

    const cards = this.findColorableCards();
    let coloredCount = 0;

    cards.forEach(card => {
      const eventId = card.getAttribute('data-eventid');
      const color = this.config.colorMap.get(eventId);

      if (color && this.getCardType(card) !== 'RESIZE_HANDLE') {
        if (this.paintCard(card, color)) {
          coloredCount++;
        }
      }
    });

    console.log(`🎨 Colored ${coloredCount} cards`);
    return coloredCount;
  },

  /**
   * Clear all colors
   */
  clearColors() {
    const coloredCards = document.querySelectorAll('[data-colored-by-extension]');
    coloredCards.forEach(card => this.clearCardPaint(card));
    console.log(`🧹 Cleared ${coloredCards.length} colored cards`);
  },

  /**
   * Setup mutation observer for dynamic content
   */
  setupMutationObserver() {
    this.config.mutationObserver = new MutationObserver((mutations) => {
      if (!this.config.enabled) return;

      // Debounce recoloring to avoid performance issues
      if (this.recolorTimeout) {
        clearTimeout(this.recolorTimeout);
      }

      this.recolorTimeout = setTimeout(() => {
        this.applyColors();
      }, 100);
    });
  },

  /**
   * Color by event ID (utility function)
   */
  colorByEventId(eventId, color) {
    const cards = document.querySelectorAll(`[data-eventid="${eventId}"]${this.selectors.exclude}`);
    let count = 0;

    cards.forEach(card => {
      if (this.getCardType(card) !== 'RESIZE_HANDLE') {
        if (this.paintCard(card, color)) {
          count++;
        }
      }
    });

    return count;
  }
};

// Make globally accessible
window.TaskColoring = TaskColoring;
```

---

## 📋 Implementation Steps

### Phase 1: Core Module Creation
1. ✅ Create `src/content/task-coloring.js` with core logic
2. ✅ Create `src/content/color-config.js` for color schemes
3. ✅ Update `manifest.json` to include new files

### Phase 2: Integration
4. ✅ Update `content.js` to initialize TaskColoring
5. ✅ Add UI controls to `inspector-ui.js` for enabling/testing coloring
6. ✅ Connect color map from API data to coloring system

### Phase 3: Testing & Refinement
7. ✅ Test on week view
8. ✅ Test on day view
9. ✅ Test on month view
10. ✅ Verify MutationObserver works with calendar navigation
11. ✅ Performance optimization if needed

---

## 🧪 Testing Strategy

### Test Cases:

#### 1. Card Type Detection
```javascript
// Test in console:
const cards = document.querySelectorAll('[data-eventid]');
cards.forEach(card => {
  const type = TaskColoring.getCardType(card);
  const id = card.getAttribute('data-eventid').substring(0, 20);
  console.log(`${id}... => ${type}`);
});
```

#### 2. Coloring by Event ID
```javascript
// Color a specific event
TaskColoring.colorByEventId('EVENT_ID_HERE', '#ff6b6b');

// Color a specific task
TaskColoring.colorByEventId('ttb_TASK_ID_HERE', '#4ecdc4');
```

#### 3. Batch Coloring
```javascript
// Set color map and apply
TaskColoring.setColorMap({
  'event_id_1': '#ff6b6b',
  'event_id_2': '#4ecdc4',
  'ttb_task_id_1': '#f9ca24'
});
TaskColoring.setEnabled(true);
```

#### 4. Dynamic Updates
```javascript
// Navigate to different week and verify re-coloring
// Should automatically detect new cards and apply colors
```

---

## 🎨 Color Scheme Recommendations

### Default Task Colors (by status):
```javascript
const TASK_COLORS = {
  needsAction: '#ff6b6b',  // Red - needs attention
  completed: '#51cf66',    // Green - done
  cancelled: '#868e96',    // Gray - cancelled
  default: '#ffd93d'       // Yellow - pending
};
```

### Default Event Colors (by calendar):
```javascript
// Use API colorId field
const EVENT_COLORS = {
  '1': '#a4bdfc',  // Lavender
  '2': '#7ae7bf',  // Sage
  '3': '#dbadff',  // Grape
  '4': '#ff887c',  // Flamingo
  '5': '#fbd75b',  // Banana
  '6': '#ffb878',  // Tangerine
  '7': '#46d6db',  // Peacock
  '8': '#e1e1e1',  // Graphite
  '9': '#5484ed',  // Blueberry
  '10': '#51b749', // Basil
  '11': '#dc2127'  // Tomato
};
```

---

## ⚠️ Known Limitations

1. **Resize Handles**: Must explicitly filter out `.leOeGd` elements
2. **Task Rollover**: Special handling for `tasks_rollover_view` ID
3. **Multiple Elements per Event**: Some events have multiple DOM elements (main + resize handle)
4. **Dynamic Loading**: Calendar lazy-loads content, MutationObserver required
5. **CSS Specificity**: Inline styles from Google Calendar may require `!important` overrides

---

## 🚀 Quick Start for Implementation

1. Read this plan thoroughly
2. Create `task-coloring.js` with the provided code
3. Update `manifest.json` to include new file
4. Test in console on live Google Calendar
5. Integrate with existing inspector UI
6. Add user controls for color configuration

---

## 📊 Success Metrics

- ✅ 100% of tasks correctly identified
- ✅ 100% of events correctly identified
- ✅ 0% resize handles incorrectly colored
- ✅ Colors persist during calendar navigation
- ✅ No performance degradation (<100ms for full recolor)

---

## 🔗 References

- Analysis File: `calendar-complete-analysis-1764771280664.json`
- Current Scanner: `src/content/scanner.js`
- Inspector UI: `src/content/inspector-ui.js`
