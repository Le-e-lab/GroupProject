# How to Create Custom Routes for Campus Map

This guide explains how to use the built-in **Path Recorder** on the map page to generate coordinates for new walking paths (shortcuts) and add them to the code.

## 1. Use the Path Recorder Tool

1.  Open the student map page in your browser: `http://localhost:3000/pages/student/map.html`
2.  Click the **"Record Path"** button in the top-left control panel.
3.  **Start Recording**: Click on a **Pin** (e.g., "Student Accommodation") to start the path. A popup will confirm "Started: [Venue Name]".
4.  **Draw the Route**: Click along the walking path on the map to drop waypoints. Try to follow the actual walkways.
5.  **Finish Recording**: Click on the **Destination Pin** (e.g., "ICT Complex") to complete the route.
6.  A popup will appear with the generated route array.

## 2. Copy the Coordinates

1.  Open your browser's Developer Console (`F12` or right-click -> Inspect -> Console).
2.  Look for the log output starting with: **"Recorded Path Code:"**.
3.  Copy the entire array string that looks like this:
    ```javascript
    [[-18.8965, 32.6027], [-18.8964, 32.6025], ... ]
    ```

## 3. Add to Code (`map.html`)

1.  Open the file: `public/pages/student/map.html`
2.  Search for the variable `const customRoutes = {`.
3.  Add a new entry with a unique key. The key format should be `start_end` (lowercase keys from the `venues` object).
    *   Example: If connecting `accommodation` to `su`, key is `"accommodation_su"`.
4.  Paste your copied coordinates array as the value.

**Example:**

```javascript
const customRoutes = {
    // ... existing routes ...
    "accommodation_su": [[-18.8965,32.6027], ...],
    
    // PASTE YOUR NEW ROUTE HERE:
    "NEW_ROUTE_KEY": YOUR_COPIED_ARRAY
};
```

## 4. Smart Routing Logic

You don't need to record every possible combination! The system automatically chains routes together.
*   If you have a route **A -> B**
*   And a route **B -> C**
*   The map can automatically navigate **A -> C** by combining them.

**Tip**: Focus on recording short segments between major hubs (e.g., "Accommodation to Dining Hall", "Dining Hall to ICT").

## 5. Verify

1.  Save `map.html`.
2.  Refresh the browser.
3.  Select your Start and End points in the navigation dropdowns.
4.  Click "Navigate" to ensure the line draws correctly.
