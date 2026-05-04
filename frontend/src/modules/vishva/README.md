# Vishva Module - Frontend

## Owner
**Vishva**

## Description
Web workspace UI for Vishva’s Menu Extraction & Category Classification system.

The page provides:
- URL-based extraction (with streaming agent progress)
- ML training (with streaming progress)
- Category prediction for typed items and uploaded files
- Export of prediction results
- Training-data CRUD (edit labels, merge/split)
- Performance dashboard (metrics + confusion matrix)
- Settings (abbreviations + confidence thresholds) and feedback workflow

## Technology Used

### Frontend App
- React (function components + hooks)
- Vite (dev server + build tooling)
- Tailwind CSS (styling via project-wide utility classes)
- React Router (route mounted at `/vishva`)

### API Integration
- Browser `fetch` (JSON REST calls)
- Server-Sent Events (SSE) via `EventSource` for live extraction/training/agent updates
- File upload with `FormData` for CSV/PDF inputs

### Shared UI Building Blocks
- Uses shared components from `src/components/` such as `PingButton`
- Uses centralized API helpers in `src/lib/api.js` (Vishva-specific functions under “VISHVA MODULE API FUNCTIONS”)

## Files in this folder
- `VishvaPage.jsx` - Main page component (EDIT THIS)
- Add more files as needed (e.g., `components/`, `hooks/`, `utils/`)

## Route
Your module page is available at `/vishva`

## How to customize
1. Open `VishvaPage.jsx`
2. Modify the page header, description, and layout
3. Add your custom components in the designated area
4. Create subfolders for complex components

## API Integration
The page automatically connects to:
- `GET /api/v1/vishva/ping` - via PingButton component
- `POST /api/v1/vishva/chat` - via ChatBox component

## Adding new API calls
```jsx
import { apiRequest } from '../../lib/api';

// In your component:
const response = await fetch('/api/v1/vishva/your-endpoint');
```

## Notes
- Keep all your frontend code in this folder
- Use shared components from `src/components/` when possible
- Don't modify files outside this folder unless necessary
