# Frontend Application

This is the React + Vite frontend for the RP Project.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at http://localhost:5173

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Structure

```
frontend/
├── src/
│   ├── components/      # Shared UI components
│   │   ├── Layout.jsx   # Main layout with sidebar
│   │   ├── ChatBox.jsx  # Reusable chat interface
│   │   └── PingButton.jsx
│   ├── lib/
│   │   └── api.js       # API client helper
│   ├── pages/
│   │   └── HomePage.jsx # Dashboard home page
│   ├── modules/         # Each team member's pages
│   │   ├── vinushan/
│   │   ├── vishva/
│   │   ├── nandika/
│   │   └── ayathma/
│   ├── App.jsx          # Route definitions
│   ├── main.jsx         # Entry point
│   └── index.css        # Global styles + Tailwind
├── package.json
├── vite.config.js       # Vite config with API proxy
├── tailwind.config.js   # Tailwind configuration
└── README.md
```

## Environment Variables

Copy `.env.example` to `.env.local` and customize as needed.

- `VITE_API_BASE_URL` - Backend API URL (optional, uses proxy by default)

## Tech Stack

- React 18
- Vite
- Tailwind CSS
- React Router v6
