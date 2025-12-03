# Calendar-Tasks Mapping Inspector

A developer tool for inspecting and mapping Google Calendar UI elements to their corresponding API data. This Chrome extension helps you discover stable selectors, attributes, and patterns for reliably identifying and manipulating calendar events and tasks in the DOM.

## 🎯 Purpose

This tool is designed to help developers who are building browser extensions or tools that interact with Google Calendar's UI. It:

- **Extracts all visual cards** from the Google Calendar UI (events and tasks)
- **Captures hierarchical context** (parents, children, siblings) with all attributes
- **Fetches API data** from Google Calendar and Tasks APIs
- **Exports everything as JSON** for offline analysis
- **Reveals connections** between DOM elements and API data

## 🚀 Quick Start

### 1. Clone and Setup

```bash
git clone https://github.com/yourusername/googlecaluiscanner.git
cd googlecaluiscanner
```

### 2. Generate Icons

Open `icons/generate-icons.html` in your browser and click the buttons to download:
- `icon16.png`
- `icon48.png`
- `icon128.png`

Save them in the `icons/` directory.

### 3. Configure OAuth

**This is the most important step!** Follow the [OAuth Setup Guide](#oauth-setup-guide) below.

### 4. Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `googlecaluiscanner` directory
5. The extension should now appear in your extensions list

### 5. Use the Tool

1. Navigate to [calendar.google.com](https://calendar.google.com)
2. Click the extension icon and enable "Inspector Mode"
3. A floating panel will appear on the calendar page
4. Click "🔍 Scan DOM" to extract all visual cards
5. Click "📡 Fetch API Data" to get Calendar and Tasks API data
6. Click "💾 Export" buttons to download JSON files
7. Analyze the JSON files to discover mapping patterns

## 📖 OAuth Setup Guide

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name (e.g., "Calendar Inspector")
4. Click "Create"

### Step 2: Enable Required APIs

1. In the Cloud Console, go to "APIs & Services" → "Library"
2. Search for and enable:
   - **Google Calendar API**
   - **Google Tasks API**

### Step 3: Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Select "External" user type (unless you have a Google Workspace)
3. Click "Create"
4. Fill in required fields:
   - **App name**: Calendar Inspector
   - **User support email**: your email
   - **Developer contact email**: your email
5. Click "Save and Continue"
6. **Scopes**: Click "Add or Remove Scopes"
   - Add: `https://www.googleapis.com/auth/calendar.readonly`
   - Add: `https://www.googleapis.com/auth/tasks.readonly`
7. Click "Save and Continue"
8. **Test users**: Add your Google account email
9. Click "Save and Continue"

### Step 4: Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: **Chrome Extension**
4. Name: "Calendar Inspector Extension"
5. For **Application ID**:
   - Load your unpacked extension in Chrome (if not already loaded)
   - Go to `chrome://extensions/`
   - Find your extension and copy its ID (e.g., `abcdefghijklmnopqrstuvwxyz123456`)
6. Paste the extension ID in the Application ID field
7. Click "Create"
8. Copy the **Client ID** (looks like `123456789-abcdefg.apps.googleusercontent.com`)

### Step 5: Update manifest.json

1. Open `manifest.json` in your project
2. Find the `oauth2` section
3. Replace `YOUR_CLIENT_ID.apps.googleusercontent.com` with your actual Client ID:

```json
"oauth2": {
  "client_id": "123456789-abcdefg.apps.googleusercontent.com",
  "scopes": [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/tasks.readonly"
  ]
}
```

4. Save the file

### Step 6: Reload Extension

1. Go to `chrome://extensions/`
2. Click the reload icon on your extension
3. The extension is now ready to authenticate!

### Step 7: Test Authentication

1. Open the extension popup
2. Check the auth status (should say "Not configured" initially)
3. Navigate to calendar.google.com
4. Enable Inspector Mode
5. Click "Fetch API Data"
6. You'll be prompted to sign in and authorize
7. Grant the requested permissions
8. The extension should now be able to fetch data!

## 🔍 How It Works

### DOM Scanner

The scanner identifies visual card elements using multiple strategies:
- Elements with `role="button"` and `data-draggable-id`
- Elements with `data-eventid` or `data-task-id`
- Generic calendar event/task patterns

For each card, it extracts:
- **Visual target**: The actual element you'd want to paint/style
- **All attributes**: id, class, data-*, aria-*, role, etc.
- **Parents** (5 levels up): Where IDs might be stored
- **Children** (3 levels deep): Where content might be
- **Siblings**: Nearby elements with potential metadata
- **Position**: Bounding box, coordinates
- **Computed styles**: Colors, display properties

### API Fetcher

Fetches data from:
- **Calendar API**: All events in the visible date range
- **Tasks API**: All tasks from all task lists in the date range

### Export Format

Scan results (`calendar-scan-[timestamp].json`):
```json
{
  "timestamp": "2025-12-03T12:00:00.000Z",
  "url": "https://calendar.google.com/...",
  "visibleRange": {
    "startDateISO": "2025-12-01",
    "endDateISO": "2025-12-07",
    "viewType": "week"
  },
  "cards": [
    {
      "cardIndex": 0,
      "visualTarget": {
        "tagName": "DIV",
        "id": "...",
        "classList": ["event-chip", "..."],
        "attributes": { "data-eventid": "abc123", ... },
        "dataset": { "eventid": "abc123", ... },
        "rect": { "x": 100, "y": 200, "width": 300, "height": 80 },
        "textContent": "Team Meeting",
        ...
      },
      "parents": [ /* 5 levels of parent context */ ],
      "children": [ /* child elements */ ],
      "siblings": [ /* nearby siblings */ ]
    }
  ]
}
```

API results (`calendar-api-[timestamp].json`):
```json
{
  "events": [
    {
      "id": "abc123",
      "summary": "Team Meeting",
      "start": { "dateTime": "2025-12-03T14:00:00Z" },
      "end": { "dateTime": "2025-12-03T15:00:00Z" },
      "colorId": "1",
      ...
    }
  ],
  "tasks": [
    {
      "id": "task456",
      "title": "Review PR",
      "due": "2025-12-03T00:00:00.000Z",
      "status": "needsAction",
      "taskListId": "...",
      ...
    }
  ]
}
```

## 💡 Usage Tips

### Finding Mappings

After exporting both scan and API data:

1. **Look for direct IDs**: Check if `data-eventid` matches `event.id`
2. **Check parent context**: ID might be on a parent element
3. **Title matching**: Compare `textContent` with `summary` or `title`
4. **Date/time matching**: Use `rect` position + date headers
5. **Visual properties**: Look for `colorId` or style patterns

### Example Analysis Workflow

```javascript
// Load your exported JSON files
const scanData = require('./calendar-scan-1234567890.json');
const apiData = require('./calendar-api-1234567890.json');

// Find cards with data-eventid
const cardsWithEventId = scanData.cards.filter(card =>
  card.visualTarget.attributes['data-eventid']
);

console.log(`Found ${cardsWithEventId.length} cards with data-eventid`);

// Try to match to API events
cardsWithEventId.forEach(card => {
  const eventId = card.visualTarget.attributes['data-eventid'];
  const apiEvent = apiData.events.find(e => e.id === eventId);

  if (apiEvent) {
    console.log('✅ MATCH FOUND:');
    console.log('  Card text:', card.visualTarget.textContent);
    console.log('  API summary:', apiEvent.summary);
    console.log('  Visual target:', card.visualTarget.cssPath);
  }
});
```

### Console Commands

When Inspector Mode is active, these commands are available in the console:

```javascript
// Quick scan
scanCalendar()

// Scan and export
exportScan()

// Access last results
window.CAL_SCAN_DATA
window.CAL_API_DATA
```

## 🎨 Visual Features

- **Highlight mode**: Toggle overlays on all detected cards
- **Index badges**: Each card shows its index number
- **Click to inspect**: Click any card to see its data in console
- **Draggable panel**: Move the inspector panel anywhere

## ⌨️ Keyboard Shortcuts

- `Ctrl+Shift+I`: Toggle Inspector Mode (when on calendar.google.com)

## 🔧 Troubleshooting

### "Auth: Not configured"

- Make sure you completed all OAuth setup steps
- Double-check your Client ID in `manifest.json`
- Verify the extension ID matches the one in Google Cloud Console

### "No cards found"

- Make sure you're on the calendar view (not settings or other pages)
- Try switching calendar views (day/week/month)
- Check console for errors

### "API fetch failed"

- Check that both APIs are enabled in Google Cloud Console
- Verify your scopes in OAuth consent screen
- Try clearing auth cache in the popup

### Extension won't load

- Check for syntax errors in the code
- Make sure all files are in the correct directories
- Generate and add the icon PNG files

## 📚 Project Structure

```
googlecaluiscanner/
├── manifest.json              # Extension configuration
├── src/
│   ├── content/
│   │   ├── scanner.js         # DOM scanning logic
│   │   ├── inspector-ui.js    # Visual inspector UI
│   │   └── content.js         # Main content script
│   ├── background/
│   │   └── background.js      # OAuth + API calls
│   ├── popup/
│   │   ├── popup.html         # Extension popup UI
│   │   └── popup.js           # Popup logic
│   └── styles/
│       └── inspector.css      # Inspector styles
├── icons/
│   ├── generate-icons.html    # Icon generator
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md                  # This file
```

## 🔐 Privacy & Security

- This tool only requests **read-only** access to Calendar and Tasks
- No data is transmitted to external servers
- All scanning and analysis happens locally in your browser
- OAuth tokens are managed by Chrome's identity API
- This is a **developer-only tool** - not intended for end users

## 📝 License

MIT License - feel free to modify and use for your projects!

## 🤝 Contributing

This is a developer tool. Feel free to:
- Report issues
- Submit improvements
- Share your findings

## ❓ FAQ

**Q: Can I use this to modify calendar events?**
A: No, this tool is read-only. It's designed for inspection and analysis only.

**Q: Will Google's UI changes break this?**
A: Possibly. The tool uses heuristics to detect cards. When Google updates their UI, you may need to update the selectors in `scanner.js`.

**Q: Can I use this on other calendar apps?**
A: Not without modifications. It's specifically designed for Google Calendar's web UI.

**Q: How do I use the findings in my own extension?**
A: Analyze the exported JSON to discover reliable selectors and attributes, then implement similar logic in your extension's content script.

## 🎓 Learning Resources

- [Chrome Extension Development](https://developer.chrome.com/docs/extensions/)
- [Google Calendar API](https://developers.google.com/calendar/api)
- [Google Tasks API](https://developers.google.com/tasks)
- [OAuth 2.0 for Extensions](https://developer.chrome.com/docs/extensions/reference/identity/)

---

**Happy mapping! 🗺️**
