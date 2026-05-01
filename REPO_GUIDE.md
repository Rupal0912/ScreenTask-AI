# ScreenTask AI Repo Guide

This document explains where the important code lives, what each file does, and the step-by-step flow of the app.

## Project Overview

ScreenTask AI is a Chrome extension plus a Node.js backend.

The extension captures a screenshot from the current browser tab. The backend sends that screenshot to Groq's vision model, extracts tasks from the image, saves them in MongoDB, and returns them to the extension popup.

## Folder Structure

```text
screentask-ai/
  README.md
  REPO_GUIDE.md
  backend/
    server.js
    package.json
    package-lock.json
  extension/
    manifest.json
    popup.html
    popup.js
    background.js
    content.js
    DEMO.png
```

## Main Runtime Flow

1. User opens the Chrome extension popup.
2. Popup loads existing tasks from `GET /tasks`.
3. User clicks either `Full page` or `Select region`.
4. For full-page capture, `popup.js` sends a message to `background.js`.
5. For region capture, `popup.js` injects `content.js`, which lets the user drag-select an area.
6. `background.js` captures the visible tab using Chrome APIs.
7. If region capture was used, `background.js` crops the screenshot with `OffscreenCanvas`.
8. `background.js` sends the image to the backend route `POST /process-screenshot`.
9. `backend/server.js` sends the image to Groq's vision model.
10. Groq returns JSON task data.
11. `backend/server.js` saves tasks in MongoDB using Mongoose.
12. Popup refreshes tasks and shows them sorted by priority.
13. User can complete, undo, or delete tasks from the popup.

## Backend Code Map

### `backend/server.js`

This is the whole backend application.

Important responsibilities:

- Loads environment variables with `dotenv`.
- Starts an Express server on port `3000`.
- Connects to MongoDB using `process.env.MONGODB_URI`.
- Defines the MongoDB task schema.
- Creates the Mongoose `Task` model.
- Creates a Groq client using `process.env.GROQ_API_KEY`.
- Defines all API routes used by the Chrome extension.

Main backend sections:

| Section | What it does |
|---|---|
| Imports and app setup | Loads `express`, `cors`, `groq-sdk`, `mongoose`, and creates the Express app. |
| MongoDB connection | Connects to MongoDB Atlas using `MONGODB_URI`. |
| Task schema | Defines task fields: `title`, `type`, `priority`, `deadline`, `completed`, `createdAt`. |
| Groq client | Uses the Groq API key and model `meta-llama/llama-4-scout-17b-16e-instruct`. |
| Middleware | Enables CORS and accepts JSON payloads up to `10mb`. |
| Routes | Handles screenshot processing, task listing, updates, and deletion. |

Backend routes:

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/` | Health check route. Returns a message that the backend is running. |
| `POST` | `/process-screenshot` | Receives base64 image data, asks Groq to extract tasks, saves them to MongoDB, and returns saved tasks. |
| `GET` | `/tasks` | Fetches all tasks from MongoDB, newest first. |
| `PATCH` | `/task/:id` | Updates a task, mainly used to mark complete or undo complete. |
| `DELETE` | `/task/:id` | Deletes one task by MongoDB id. |

Expected backend environment file:

```text
backend/.env
```

Required values:

```env
MONGODB_URI=your_mongodb_connection_string
GROQ_API_KEY=your_groq_api_key
```

## Extension Code Map

### `extension/manifest.json`

This is the Chrome extension configuration file.

Important responsibilities:

- Uses Manifest V3.
- Names the extension `ScreenTask AI`.
- Sets `popup.html` as the default popup.
- Registers `background.js` as the service worker.
- Allows access to the local backend through `http://localhost:3000/*`.
- Requests Chrome permissions:
  - `activeTab`
  - `scripting`
  - `tabs`
  - `storage`

### `extension/popup.html`

This file contains the popup UI and styling.

Important responsibilities:

- Builds the popup layout.
- Contains the buttons:
  - `Full page`
  - `Select region`
- Contains the task count element.
- Contains the task list container with id `tasks`.
- Loads `popup.js`.

Most CSS is written directly inside this file.

### `extension/popup.js`

This file controls the popup behavior.

Important responsibilities:

- Waits for `DOMContentLoaded`.
- Handles the `Full page` button click.
- Handles the `Select region` button click.
- Loads tasks from the backend.
- Renders task cards in the popup.
- Sorts tasks by priority:
  - high
  - medium
  - low
- Sends delete requests to the backend.
- Sends complete/undo requests to the backend.
- Shows temporary popup/toast messages.

Main functions:

| Function | Purpose |
|---|---|
| `loadTasks()` | Fetches tasks from `http://localhost:3000/tasks` and renders them. |
| `deleteTask(id)` | Calls `DELETE /task/:id`. |
| `toggleComplete(id, status)` | Calls `PATCH /task/:id` with a new `completed` value. |
| `showToast(message)` | Shows a temporary status message inside the popup. |
| `showCapturePopup()` | Shows a temporary screenshot-captured message. |

Important flow in this file:

- Full-page capture:
  - Sends `{ action: "captureScreenshot" }` to `background.js`.
  - Waits briefly.
  - Calls `loadTasks()` again.

- Region capture:
  - Finds the active tab.
  - Injects `content.js`.
  - Sends `{ action: "startSelection" }` to the content script.
  - Closes the popup so the user can drag-select on the page.

### `extension/background.js`

This file is the Manifest V3 service worker.

Important responsibilities:

- Listens for messages from `popup.js` and `content.js`.
- Captures screenshots using `chrome.tabs.captureVisibleTab`.
- Crops selected regions using `OffscreenCanvas`.
- Sends screenshots to the backend.
- Stores returned tasks in `chrome.storage.local`.

Main message actions:

| Action | Source | Purpose |
|---|---|---|
| `captureScreenshot` | `popup.js` | Captures the visible tab and sends it to the backend. |
| `regionSelected` | `content.js` | Captures the visible tab, crops the selected rectangle, and sends the cropped image to the backend. |

Main function:

| Function | Purpose |
|---|---|
| `sendToBackend(imageData)` | Sends base64 image data to `POST /process-screenshot`. |

### `extension/content.js`

This file is injected into the current webpage only when region selection is needed.

Important responsibilities:

- Creates a full-page overlay.
- Lets the user drag to select a rectangle.
- Removes the overlay when selection is done.
- Cancels selection when the user presses `Escape`.
- Sends the selected rectangle to `background.js`.

Main functions:

| Function | Purpose |
|---|---|
| `createOverlay()` | Adds the dark overlay and selection rectangle to the page. |
| `onMouseDown(e)` | Starts the drag selection. |
| `onMouseMove(e)` | Updates the selection rectangle size and position. |
| `onMouseUp(e)` | Finishes selection and sends dimensions to `background.js`. |
| `removeOverlay()` | Removes the overlay from the page. |

Message handled:

```js
{ action: "startSelection" }
```

Message sent:

```js
{ action: "regionSelected", rect }
```

## API Data Shape

Tasks saved in MongoDB use this shape:

```js
{
  title: String,
  type: String,
  priority: String,
  deadline: String | null,
  completed: Boolean,
  createdAt: Date
}
```

The AI response is expected to be:

```json
{
  "tasks": [
    {
      "title": "task description",
      "type": "task or reminder or note",
      "priority": "high or medium or low",
      "deadline": "deadline if found, or null"
    }
  ]
}
```

## Setup Steps

### 1. Install backend dependencies

```bash
cd backend
npm install
```

### 2. Create backend environment file

Create:

```text
backend/.env
```

Add:

```env
MONGODB_URI=your_mongodb_connection_string
GROQ_API_KEY=your_groq_api_key
```

### 3. Start backend server

```bash
cd backend
node server.js
```

Expected backend URL:

```text
http://localhost:3000
```

### 4. Load Chrome extension

1. Open Chrome.
2. Go to `chrome://extensions/`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the `extension/` folder.
6. Pin or open the `ScreenTask AI` extension.

## Development Notes

- The backend must be running before the extension can process screenshots.
- The extension is hardcoded to call `http://localhost:3000`.
- All tasks are global because there is no authentication or per-user filtering.
- `chrome.storage.local` is written in `background.js`, but the popup mainly reads directly from the backend.
- Duplicate tasks are possible if the same screenshot is processed multiple times.
- There are no automated tests in the repo right now.

## Common Places To Edit

| Goal | File to edit |
|---|---|
| Change backend routes | `backend/server.js` |
| Change AI model or prompt | `backend/server.js` |
| Change MongoDB task fields | `backend/server.js` |
| Change popup layout or CSS | `extension/popup.html` |
| Change popup actions or task rendering | `extension/popup.js` |
| Change screenshot capture behavior | `extension/background.js` |
| Change region selection overlay | `extension/content.js` |
| Change extension permissions or backend URL permissions | `extension/manifest.json` |

