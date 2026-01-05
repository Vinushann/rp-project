"""
Main FastAPI Application
========================
This is the entry point for the backend API.
Each team member's module is mounted as a separate router with its own prefix.
"""

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
        "http://localhost:3000",  # Alternative port
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


# Mount module routers with their prefixes
# Each teammate works on their own router file
app.include_router(vinushan_router, prefix="/api/v1/vinushan", tags=["Vinushan Module"])
app.include_router(vishva_router, prefix="/api/v1/vishva", tags=["Vishva Module"])
app.include_router(nandika_router, prefix="/api/v1/nandika", tags=["Nandika Module"])
app.include_router(ayathma_router, prefix="/api/v1/ayathma", tags=["Ayathma Module"])
