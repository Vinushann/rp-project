# Ayathma Module - Frontend

## Owner
**Ayathma**

## Description
[Add your module description here]

## Files in this folder
- `AyathmaPage.jsx` - Main page component (EDIT THIS)
- Add more files as needed (e.g., `components/`, `hooks/`, `utils/`)

## Route
Your module page is available at `/ayathma`

## How to customize
1. Open `AyathmaPage.jsx`
2. Modify the page header, description, and layout
3. Add your custom components in the designated area
4. Create subfolders for complex components

## API Integration
The page automatically connects to:
- `GET /api/v1/ayathma/ping` - via PingButton component
- `POST /api/v1/ayathma/chat` - via ChatBox component

## Adding new API calls
```jsx
import { apiRequest } from '../../lib/api';

// In your component:
const response = await fetch('/api/v1/ayathma/your-endpoint');
```

## Notes
- Keep all your frontend code in this folder
- Use shared components from `src/components/` when possible
- Don't modify files outside this folder unless necessary
