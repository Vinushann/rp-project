# RP Project - Monorepo

A multi-module web application for the Final Year Research Project.

## 📁 Project Structure

```
rp-project-root/
├── apps/
│   ├── backend/                    # FastAPI Backend
│   │   ├── app/
│   │   │   ├── main.py            # Main FastAPI app (entry point)
│   │   │   ├── schemas.py         # Shared Pydantic models
│   │   │   └── modules/           # Module-specific code
│   │   │       ├── vinushan/      # Vinushan's backend code
│   │   │       ├── vishva/        # Vishva's backend code
│   │   │       ├── nandika/       # Nandika's backend code
│   │   │       └── ayathma/       # Ayathma's backend code
│   │   └── requirements.txt       # Python dependencies
│   │
│   └── frontend/                   # React + Vite Frontend
│       ├── src/
│       │   ├── components/        # Shared UI components
│       │   ├── lib/               # Shared utilities (API client)
│       │   ├── pages/             # Main pages (Home)
│       │   └── modules/           # Module-specific pages
│       │       ├── vinushan/      # Vinushan's frontend code
│       │       ├── vishva/        # Vishva's frontend code
│       │       ├── nandika/       # Nandika's frontend code
│       │       └── ayathma/       # Ayathma's frontend code
│       └── package.json           # Node dependencies
│
├── shared/                         # Shared resources (optional)
│   └── README.md
│
└── README.md                       # This file
```

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm or yarn

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd rp-project-root
```

### 2. Start the Backend

```bash
# Navigate to backend
cd apps/backend

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn app.main:app --reload --port 8000
```

The API will be available at: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Health Check: http://localhost:8000/health

### 3. Start the Frontend

```bash
# In a new terminal, navigate to frontend
cd apps/frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The frontend will be available at: http://localhost:5173

## 👥 Team Structure

| Member | Module | Backend Path | Frontend Path | API Prefix |
|--------|--------|--------------|---------------|------------|
| Vinushan | vinushan-component | `apps/backend/app/modules/vinushan/` | `apps/frontend/src/modules/vinushan/` | `/api/v1/vinushan` |
| Vishva | vishva-component | `apps/backend/app/modules/vishva/` | `apps/frontend/src/modules/vishva/` | `/api/v1/vishva` |
| Nandika | nandika-component | `apps/backend/app/modules/nandika/` | `apps/frontend/src/modules/nandika/` | `/api/v1/nandika` |
| Ayathma | ayathma-component | `apps/backend/app/modules/ayathma/` | `apps/frontend/src/modules/ayathma/` | `/api/v1/ayathma` |

## 📡 API Endpoints

Each module has the following endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/{module}/ping` | Health check |
| POST | `/api/v1/{module}/chat` | Chat endpoint |

### Example: Ping Request
```bash
curl http://localhost:8000/api/v1/vinushan/ping
```
Response:
```json
{"module": "vinushan", "status": "ok"}
```

### Example: Chat Request
```bash
curl -X POST http://localhost:8000/api/v1/vinushan/chat \
  -H "Content-Type: application/json" \
  -d '{"session_id": "test-123", "message": "Hello!"}'
```
Response:
```json
{"reply": "Dummy reply from vinushan: You said 'Hello!'", "session_id": "test-123", "module": "vinushan"}
```

## 🔧 Development Workflow

### For Individual Development
1. Clone the repo
2. Work only in your module folder:
   - Backend: `apps/backend/app/modules/<your-name>/`
   - Frontend: `apps/frontend/src/modules/<your-name>/`
3. Test your changes locally
4. Push to your branch

### For Combined Demo
1. Pull all changes from main branch
2. Start ONE backend (it serves all modules)
3. Start ONE frontend (it has all module pages)
4. Navigate between modules using the sidebar

## 📝 Adding New Features

### Backend
1. Go to your module folder: `apps/backend/app/modules/<your-name>/`
2. Edit `router.py` to add new endpoints
3. Create additional files as needed (services.py, models.py, etc.)

### Frontend
1. Go to your module folder: `apps/frontend/src/modules/<your-name>/`
2. Edit your page component
3. Create additional components in subfolders

## 🌐 CORS Configuration

CORS is configured in the backend (`app/main.py`) to allow requests from:
- http://localhost:5173 (Vite dev server)
- http://localhost:3000

The frontend also uses a Vite proxy (`vite.config.js`) to forward `/api` requests to the backend, avoiding CORS issues in development.

## 📦 Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS + React Router
- **Backend**: FastAPI + Python 3.10+ + Pydantic
- **Communication**: REST API with JSON

## 🤝 Git Workflow Recommendations

```bash
# Create your feature branch
git checkout -b feature/vinushan-chat-improvement

# Work on your changes
# ...

# Commit with clear messages
git add .
git commit -m "feat(vinushan): add sentiment analysis to chat"

# Push to remote
git push origin feature/vinushan-chat-improvement

# Create Pull Request on GitHub
```
