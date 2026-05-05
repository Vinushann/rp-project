"""
Main FastAPI Application
========================
This is the entry point for the backend API.
Each team member's module is mounted as a separate router with its own prefix.
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import routers from each module
from app.modules.vinushan.router import router as vinushan_router
from app.modules.vishva.router import router as vishva_router
from app.modules.nandika.router import router as nandika_router
from app.modules.ayathma.router import router as ayathma_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler - initialize models at startup."""
    # Startup: Load ML models
    print("\n🚀 Starting RP Project API...")
    
    # Initialize Prophet model for Vinushan's forecasting module
    try:
        from app.modules.vinushan.contextawareforecastingsys.services.ts_model_registry import (
            initialize_model_registry,
        )
        if initialize_model_registry():
            print("  ✅ Prophet time series model loaded successfully")
        else:
            print("  ⚠️  Prophet model could not be loaded - forecasting may be limited")
    except Exception as e:
        print(f"  ❌ Error initializing model registry: {e}")
    
    print("✅ API startup complete\n")
    
    yield  # Application runs here
    
    # Shutdown: Cleanup (if needed)
    print("\n👋 Shutting down RP Project API...")


app = FastAPI(
    title="RP Project API",
    description="Final Year Research Project - Multi-Module Backend",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Configuration - Allow frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:5174",  # Alternative Vite port
        "http://localhost:3000",  # Alternative port
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging Middleware
from fastapi import Request
import time

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = None
    error = None
    try:
        response = await call_next(request)
        return response
    except Exception as e:
        error = str(e)
        raise e
    finally:
        process_time = time.time() - start_time
        log_dir = os.path.join(os.path.dirname(__file__), "logs")
        os.makedirs(log_dir, exist_ok=True)
        log_file = os.path.join(log_dir, "api_requests.log")
        with open(log_file, "a", encoding="utf-8") as f:
            status_code = response.status_code if response else "ERROR"
            f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {request.method} {request.url.path} - Status: {status_code} - Time: {process_time:.4f}s")
            if error:
                f.write(f" - Exception: {error}")
            f.write("\n")



@app.get("/")
async def root():
    """Health check endpoint for the main API"""
    return {
        "message": "RP Project API is running",
        "version": "1.0.0",
        "modules": ["vinushan", "vishva", "nandika", "ayathma"],
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.get("/api/v1/logs")
async def get_logs(limit: int = 100):
    """Get the last N lines from the API request log."""
    log_file = os.path.join(os.path.dirname(__file__), "logs", "api_requests.log")
    if not os.path.exists(log_file):
        return {"logs": []}
    
    try:
        with open(log_file, "r", encoding="utf-8") as f:
            # Read all lines and get the last 'limit' ones
            lines = f.readlines()
            last_lines = lines[-limit:] if len(lines) > limit else lines
            # Strip newlines and return as a list
            return {"logs": [line.strip() for line in last_lines]}
    except Exception as e:
        return {"logs": [], "error": str(e)}


# Mount module routers with their prefixes
# Each teammate works on their own router file
app.include_router(vinushan_router, prefix="/api/v1/vinushan", tags=["Vinushan Module"])
app.include_router(vishva_router, prefix="/api/v1/vishva", tags=["Vishva Module"])
app.include_router(nandika_router, prefix="/api/v1/nandika", tags=["Nandika Module"])
app.include_router(ayathma_router, prefix="/api/v1/ayathma", tags=["Ayathma Module"])
