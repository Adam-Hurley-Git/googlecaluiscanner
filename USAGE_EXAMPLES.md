# Usage Examples: From Inspection to Implementation

This guide shows you how to use the exported data from the Calendar Inspector to build your own calendar manipulation tool.

## 📊 Understanding Your Exported Data

After running a scan, you'll have two JSON files:

1. **`calendar-scan-[timestamp].json`** - DOM data with visual targets
2. **`calendar-api-[timestamp].json`** - API data with events and tasks

## 🎯 Example 1: Finding the Mapping Pattern

### Step 1: Analyze a Single Card

```javascript
// Load your scan data
const scanData = require('./calendar-scan-1234567890.json');

// Look at the first card
const firstCard = scanData.cards[0];

console.log('Visual Target:');
console.log('  Tag:', firstCard.visualTarget.tagName);
console.log('  Text:', firstCard.visualTarget.textContent);
console.log('  Classes:', firstCard.visualTarget.classList);
console.log('  Attributes:', firstCard.visualTarget.attributes);

console.log('\nParent Level 1:');
console.log('  Attributes:', firstCard.parents[0]?.attributes);

console.log('\nParent Level 2:');
console.log('  Attributes:', firstCard.parents[1]?.attributes);
```

### Step 2: Look for ID Patterns

Common patterns to check:

```javascript
// Check if the visual target has the ID
const hasEventIdOnTarget = firstCard.visualTarget.attributes['data-eventid'];

// Check if a parent has the ID
const parentWithEventId = firstCard.parents.find(p =>
  p.attributes['data-eventid']
);

// Check dataset (data-* attributes)
const datasetEventId = firstCard.visualTarget.dataset?.eventid;

console.log('Found patterns:');
console.log('  On target:', hasEventIdOnTarget);
console.log('  On parent:', parentWithEventId?.level, parentWithEventId?.attributes['data-eventid']);
console.log('  In dataset:', datasetEventId);
```

### Step 3: Match to API Data

```javascript
const apiData = require('./calendar-api-1234567890.json');

// Try to find matching event
const eventId = hasEventIdOnTarget || parentWithEventId?.attributes['data-eventid'];

if (eventId) {
  const matchedEvent = apiData.events.find(e => e.id === eventId);

  if (matchedEvent) {
    console.log('✅ MATCH FOUND!');
    console.log('Event ID:', eventId);
    console.log('Summary:', matchedEvent.summary);
    console.log('Start:', matchedEvent.start);
    console.log('Color ID:', matchedEvent.colorId);
  }
}
```

## 🎨 Example 2: Implementing a Color Tool

Once you've discovered the pattern, implement it in your own extension:

### Your Content Script

```javascript
/**
 * Color Calendar Events Based on API Data
 */

// Step 1: Get the pattern from your analysis
// Let's say you found that event IDs are in: parent[1].attributes['data-eventid']

function findVisualCardForEvent(eventId) {
  // Use the selector pattern you discovered
  const container = document.querySelector(`[data-eventid="${eventId}"]`);

  if (!container) return null;

  // Based on your scan, the visual target might be:
  // - The container itself
  // - A child element with a specific class
  // - A button role element inside

  // Example: Visual target is the first button child
  const visualTarget = container.querySelector('[role="button"]');

  return visualTarget || container;
}

function colorEvent(eventId, color) {
  const visualElement = findVisualCardForEvent(eventId);

  if (visualElement) {
    visualElement.style.backgroundColor = color;
    visualElement.style.borderLeft = `4px solid ${color}`;
    console.log(`Colored event ${eventId}`);
    return true;
  }

  return false;
}

// Step 2: Fetch API data and apply colors
async function applyEventColors() {
  // Get your auth token (you'll need OAuth setup)
  const token = await getAuthToken();

  // Fetch events
  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=...',
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );

  const data = await response.json();

  // Apply colors based on your logic
  data.items.forEach(event => {
    let color;

    // Your coloring logic
    if (event.summary.includes('Meeting')) {
      color = '#ff6b6b';
    } else if (event.summary.includes('Work')) {
      color = '#4ecdc4';
    } else {
      color = '#95e1d3';
    }

    colorEvent(event.id, color);
  });
}

// Run when calendar loads
if (window.location.hostname.includes('calendar.google.com')) {
  applyEventColors();
}
```

## 🔄 Example 3: Handling Different Element Structures

Sometimes the visual target is nested differently:

```javascript
function findVisualTargetRobust(eventId) {
  // Strategy 1: Direct data attribute
  let element = document.querySelector(`[data-eventid="${eventId}"]`);

  if (element) {
    // Check if this IS the visual target
    const rect = element.getBoundingClientRect();
    if (rect.width > 50 && rect.height > 20) {
      return element; // Looks like a visual card
    }

    // Try to find visual target inside
    const button = element.querySelector('[role="button"]');
    if (button) return button;

    const chip = element.querySelector('.event-chip, .task-chip');
    if (chip) return chip;

    // Fallback: first child with content
    const firstChild = element.querySelector('[class*="event"], [class*="chip"]');
    if (firstChild) return firstChild;
  }

  // Strategy 2: Try aria-label matching (less reliable)
  const allButtons = document.querySelectorAll('[role="button"]');
  for (const btn of allButtons) {
    // You'd need to fetch the event summary and compare
    // This is less reliable but can work as fallback
  }

  return null;
}
```

## 📍 Example 4: Using Position/Hierarchy Instead of IDs

If there are NO reliable IDs, use position:

```javascript
// From your scan data, you know:
// - Cards are in day columns
// - Each column has data-date attribute
// - Cards are ordered by time

function findCardByDateAndTime(date, timeText) {
  // Find the day column
  const dayColumn = document.querySelector(`[data-date="${date}"]`);
  if (!dayColumn) return null;

  // Find all event buttons in that column
  const events = dayColumn.querySelectorAll('[role="button"]');

  // Find by time text
  for (const event of events) {
    if (event.textContent.includes(timeText) ||
        event.getAttribute('aria-label')?.includes(timeText)) {
      return event;
    }
  }

  return null;
}

// Usage
const eventElement = findCardByDateAndTime('2025-12-03', '2:00 PM');
if (eventElement) {
  eventElement.style.backgroundColor = 'yellow';
}
```

## 🔍 Example 5: Analyzing Your Scan Results Programmatically

Create a helper script to analyze patterns across all cards:

```javascript
const fs = require('fs');

const scanData = JSON.parse(fs.readFileSync('calendar-scan-123.json'));
const apiData = JSON.parse(fs.readFileSync('calendar-api-123.json'));

// Find all unique attribute patterns
const attributePatterns = new Map();

scanData.cards.forEach(card => {
  // Check visual target
  Object.keys(card.visualTarget.attributes).forEach(attr => {
    if (attr.startsWith('data-')) {
      const count = attributePatterns.get(attr) || 0;
      attributePatterns.set(attr, count + 1);
    }
  });

  // Check parents
  card.parents.forEach(parent => {
    Object.keys(parent.attributes || {}).forEach(attr => {
      if (attr.startsWith('data-')) {
        const key = `parent[${parent.level}].${attr}`;
        const count = attributePatterns.get(key) || 0;
        attributePatterns.set(key, count + 1);
      }
    });
  });
});

console.log('Data attribute patterns:');
attributePatterns.forEach((count, attr) => {
  console.log(`  ${attr}: found on ${count} cards`);
});

// Try to match each card to an event
let matchedByEventId = 0;
let matchedByTitle = 0;
let unmatched = 0;

scanData.cards.forEach(card => {
  // Try event ID match
  const eventId = card.visualTarget.attributes['data-eventid'] ||
                  card.parents[0]?.attributes['data-eventid'] ||
                  card.parents[1]?.attributes['data-eventid'];

  if (eventId) {
    const event = apiData.events.find(e => e.id === eventId);
    if (event) {
      matchedByEventId++;
      return;
    }
  }

  // Try title match
  const cardText = card.visualTarget.textContent?.trim().toLowerCase();
  const event = apiData.events.find(e =>
    e.summary?.toLowerCase() === cardText
  );

  if (event) {
    matchedByTitle++;
    return;
  }

  unmatched++;
});

console.log('\nMatching results:');
console.log(`  ✅ By event ID: ${matchedByEventId}`);
console.log(`  ⚠️  By title: ${matchedByTitle}`);
console.log(`  ❌ Unmatched: ${unmatched}`);
console.log(`  Total cards: ${scanData.cards.length}`);
console.log(`  Total events: ${apiData.events.length}`);
```

## 🎓 Example 6: Best Practices for Your Extension

Based on your findings, implement a robust solution:

```javascript
class CalendarUIManipulator {
  constructor() {
    this.eventMap = new Map(); // eventId -> DOM element
    this.initialized = false;
  }

  async init() {
    // Wait for calendar to load
    await this.waitForCalendar();

    // Scan and build map
    this.scanDOM();

    // Watch for changes
    this.observeChanges();

    this.initialized = true;
  }

  waitForCalendar() {
    return new Promise(resolve => {
      const check = () => {
        // Use a selector you discovered from your scan
        if (document.querySelector('[data-date]')) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  scanDOM() {
    // Use the pattern you discovered
    // Example: event IDs are on parent containers
    const containers = document.querySelectorAll('[data-eventid]');

    containers.forEach(container => {
      const eventId = container.getAttribute('data-eventid');
      const visualTarget = this.findVisualTarget(container);

      if (visualTarget) {
        this.eventMap.set(eventId, visualTarget);
      }
    });

    console.log(`Mapped ${this.eventMap.size} events`);
  }

  findVisualTarget(container) {
    // Based on your scan results, implement the logic
    // to find the actual visual card element
    return container.querySelector('[role="button"]') || container;
  }

  observeChanges() {
    // Watch for calendar updates
    const observer = new MutationObserver(() => {
      this.scanDOM(); // Re-scan on changes
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  colorEvent(eventId, color) {
    const element = this.eventMap.get(eventId);
    if (element) {
      element.style.backgroundColor = color;
      return true;
    }
    return false;
  }

  highlightEvent(eventId) {
    const element = this.eventMap.get(eventId);
    if (element) {
      element.style.border = '2px solid red';
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

// Usage
const manipulator = new CalendarUIManipulator();
manipulator.init().then(() => {
  // Now you can manipulate events
  manipulator.colorEvent('some-event-id', '#ff6b6b');
});
```

## 🚨 Important Notes

### Handling Google Calendar UI Changes

Google may update their UI, breaking your selectors. To handle this:

```javascript
// Define multiple strategies
const strategies = [
  // Strategy 1: Use data-eventid (most reliable)
  (eventId) => document.querySelector(`[data-eventid="${eventId}"]`),

  // Strategy 2: Use jsname attribute
  (eventId) => document.querySelector(`[jsname][data-event="${eventId}"]`),

  // Strategy 3: Fallback to aria-label search
  (eventId) => {
    // Less reliable, but better than nothing
    // You'd need event details to construct the expected label
  }
];

function findEventElement(eventId) {
  for (const strategy of strategies) {
    const element = strategy(eventId);
    if (element) return element;
  }
  return null;
}
```

### Performance Considerations

```javascript
// Cache selectors
const selectorCache = new Map();

function findEventCached(eventId) {
  if (selectorCache.has(eventId)) {
    const element = selectorCache.get(eventId);
    // Verify it's still in DOM
    if (document.contains(element)) {
      return element;
    }
    selectorCache.delete(eventId);
  }

  // Find and cache
  const element = findEventElement(eventId);
  if (element) {
    selectorCache.set(eventId, element);
  }

  return element;
}
```

## 📚 Next Steps

1. **Run your scan** on different calendar views (day, week, month)
2. **Compare patterns** across different views
3. **Test edge cases**: all-day events, multi-day events, recurring events
4. **Handle tasks separately**: They may use different selectors
5. **Build robust fallbacks**: Don't rely on a single selector

---

Remember: The Calendar Inspector reveals the data. How you use it is up to you! 🚀
