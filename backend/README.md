# Backend Application

This is the FastAPI backend for the RP Project.

## Quick Start

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn app.main:app --reload --port 8000
```

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI app entry point
│   ├── schemas.py       # Shared Pydantic models
│   └── modules/         # Each team member's code
│       ├── vinushan/
│       ├── vishva/
│       ├── nandika/
│       └── ayathma/
├── requirements.txt
└── README.md
```

## Adding New Dependencies

```bash
# Add to requirements.txt, then:
pip install -r requirements.txt
```

## Environment Variables

Copy `.env.example` to `.env` and customize as needed.
