# Vishva Module - Backend

## Owner
**Vishva**

## Description
Menu Extraction & Category Classification system for POS-style item lists.

It supports:
- Extracting menu items from a restaurant website URL (browser automation)
- Cleaning/normalizing extracted output into structured JSON
- Training a lightweight ML classifier on the extracted labels
- Predicting categories + confidence for new items (single batch or uploaded files)
- Exporting predictions (JSON/CSV/PDF)
- Optional “agentic AI” workflow that orchestrates extract → clean → train → predict

## Technology Used

### Backend API
- FastAPI (routers + request/response handling)
- Pydantic (request/response schemas)
- Uvicorn (ASGI server)
- Server-Sent Events (SSE) via `StreamingResponse` for streaming training/extraction progress

### Web Extraction / Browser Automation
- `browser-use` Agent framework (LLM-driven browser automation)
- Playwright (browser runtime used by `browser-use`)
- `python-dotenv` for environment configuration (API keys, local setup)

### Machine Learning / NLP
- scikit-learn models: SVM, Logistic Regression, Multinomial Naive Bayes
- Feature extraction: Bag-of-Words, TF‑IDF
- Feature selection: Chi-Square, Mutual Information, LSA (TruncatedSVD)
- Evaluation: train/test split, cross-validation, accuracy + F1 metrics
- NLTK (tokenization + stopwords used in preprocessing)
- NumPy / Pandas (data handling)
- Joblib (persisting model + vectorizer + selector/scaler)

### File Handling / Reporting
- Multipart uploads (`UploadFile`) for CSV/PDF inputs
- CSV parsing (Python stdlib `csv`)
- PDF parsing: PyMuPDF (`fitz`) for text extraction
- PDF export: ReportLab for generating downloadable reports

### Agentic AI (Optional Subsystem)
- LangChain Core tools API (wrapping module tools as callable “tools”)
- LangGraph ReAct agent (`create_react_agent`) orchestration loop
- Ollama local LLM integration via `langchain-ollama` (default model: `qwen2.5:7b`)

### Data Storage (Lightweight)
- JSON files on disk for:
    - Cleaned training data (`output/menu_data.json`)
    - Model artifacts (`models/*.pkl`, `models/model_results.json`)
    - User feedback/corrections (`data/feedback.json`)
    - Abbreviation rules (`data/abbreviations.json`)
    - Confidence thresholds (`data/confidence_settings.json`)

## Files in this folder
- `router.py` - FastAPI router with endpoints (EDIT THIS)
- `__init__.py` - Module initialization
- Add more files as needed (e.g., `services.py`, `models.py`, `utils.py`)

## Endpoints
Your module is mounted at `/api/v1/vishva`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ping` | Health check |
| POST | `/chat` | Chat endpoint |

Additional implemented endpoints include extraction/training/prediction, file upload + export, streaming (SSE), training-data management, model performance metrics, feedback loop, abbreviations, confidence settings, and agent routes.

## How to add new endpoints
1. Open `router.py`
2. Add new route functions using the `@router` decorator
3. Import any dependencies you need at the top of the file

## Example: Adding a new endpoint
```python
@router.get("/my-endpoint")
async def my_endpoint():
    return {"message": "Hello from vishva module"}
```

## Notes
- Keep all your backend code in this folder
- Don't modify files outside this folder unless necessary
- Use the shared schemas from `app/schemas.py` or create your own
