# AI Chat Summarizer Feature Documentation

## Overview
The **AI Chat Summarizer** is a feature that leverages Google's Gemini Large Language Model (LLM) to generate a concise, structured summary of a conversation between two users. This helps users quickly catch up on long discussions without scrolling through the entire chat history. 

The feature is built with a responsive user interface: a right-side drawer on desktop environments and a slide-up bottom sheet on mobile devices.

---

## Architecture & Technology Stack

- **Backend**: Node.js, Express, TypeScript
- **AI Integration**: `@google/generative-ai` SDK communicating with the `gemini-2.5-flash` model.
- **Frontend**: React, Zustand (State Management), Tailwind CSS + DaisyUI (Styling), Lucide React (Icons).

---

## 1. Backend Implementation

### Environment Configuration
The backend requires a valid Gemini API key to authenticate with Google AI services.
- **Variable**: `GEMINI_API_KEY`
- **Location**: `backend/.env`

### Controller (`backend/src/controllers/summary.controller.ts`)
The `summarizeChat` controller performs the following steps:
1. **Validation & Context**: Validates the presence of the `GEMINI_API_KEY`. It extracts the `chatUserId` from request parameters and the logged-in user's ID from the JWT payload.
2. **Data Retrieval**: Fetches the last 50 messages exchanged between the two users from MongoDB, sorted sequentially.
3. **Graceful Degradation**: If no messages exist, the API bypasses the Gemini call and returns a localized "empty state" string.
4. **Prompt Engineering**: The messages are formatted into a readable transcript (e.g., `User A: Hello`). The system prompt strictly forces the LLM to output three sections:
   - 💬 Brief Overview
   - 📌 Key Discussion Points
   - ✅ Action Items & Decisions
5. **LLM Invocation**: Calls the `gemini-2.5-flash` model and returns the formatted text to the client.

### Route (`backend/src/routes/message.route.ts`)
- **Endpoint**: `GET /api/messages/summarize/:id`
- **Middleware**: Protected by `protectRoute` to ensure only authenticated users can trigger summaries.

---

## 2. Frontend Implementation

### State Management (`frontend/src/store/useChatStore.ts`)
The Zustand store was expanded to manage the summarizer's state cleanly without prop-drilling:
- **States**: 
  - `isSummaryDrawerOpen` (boolean): Controls the visibility of the UI drawer.
  - `isSummaryLoading` (boolean): Controls the skeleton loading animation.
  - `chatSummary` (string | null): Holds the Markdown-like response from the backend.
- **Actions**:
  - `setSummaryDrawerOpen(isOpen)`: Toggles the drawer.
  - `fetchChatSummary(userId)`: Triggers the backend API call and updates `chatSummary`.
- **Side Effects**: When a user selects a different chat (`setSelectedUser`), the summary state is automatically reset and the drawer is closed to prevent context leaking.

### UI Components

#### `ChatSummaryDrawer.tsx`
A highly responsive component that adapts based on viewport size:
- **Desktop**: Renders as a fixed right-side panel attached to the chat container.
- **Mobile**: Renders as a bottom sheet with a backdrop and a swipe indicator.
- **Rendering Logic**: Uses a custom `formatSummary` parser to map the Markdown-like bullet points and headers returned by Gemini into cleanly styled HTML elements (`<h4>`, `<li>`, `<p>`).
- **Interactive Elements**: Includes a loading skeleton (using Tailwind `animate-pulse`), a **Copy to Clipboard** button, and a **Refresh** button.

#### `ChatHeader.tsx`
- Injects the ✨ **Summarize** button next to the standard close/back button. Clicking this toggles the `ChatSummaryDrawer` state and fires the API request.

#### `ChatContainer.tsx`
- Refactored the structural layout using CSS Flexbox (`flex-1 flex overflow-hidden relative`) to allow the `ChatSummaryDrawer` to mount side-by-side with the main message feed on larger screens without overlapping.

---

## Future Enhancements
- **Customizable Depth**: Allow users to pass a parameter (e.g., `last 100 messages` vs `last 24 hours`).
- **Localization**: Pass the user's locale to Gemini to translate the summary dynamically.
- **Caching**: Implement a short-lived cache (e.g., Redis) based on the timestamp of the last message to reduce redundant LLM calls if the chat hasn't updated.
