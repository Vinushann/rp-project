# Ayathma Module - Backend

## Owner
**Ayathma**

## Description
[Add your module description here]

## Files in this folder
- `router.py` - FastAPI router with endpoints (EDIT THIS)
- `__init__.py` - Module initialization
- Add more files as needed (e.g., `services.py`, `models.py`, `utils.py`)

## Endpoints
Your module is mounted at `/api/v1/ayathma`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ping` | Health check |
| POST | `/chat` | Chat endpoint |

## How to add new endpoints
1. Open `router.py`
2. Add new route functions using the `@router` decorator
3. Import any dependencies you need at the top of the file

## Example: Adding a new endpoint
```python
@router.get("/my-endpoint")
async def my_endpoint():
    return {"message": "Hello from ayathma module"}
```

## Notes
- Keep all your backend code in this folder
- Don't modify files outside this folder unless necessary
- Use the shared schemas from `app/schemas.py` or create your own
