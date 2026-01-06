"""
FastAPI Application - Main entry point for the backend API.
"""

import os
import warnings
from contextlib import asynccontextmanager

# Disable CrewAI telemetry prompts BEFORE importing anything else
os.environ["CREWAI_TELEMETRY_OPT_OUT"] = "true"
os.environ["OTEL_SDK_DISABLED"] = "true"

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from .models import ChatRequest, ChatResponse, HealthResponse
from .chat_service import process_chat_message

# Suppress warnings
warnings.filterwarnings("ignore", category=SyntaxWarning, module="pysbd")
load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    print("🚀 Starting Context-Aware Forecasting API...")
    print(f"📊 Business: {os.getenv('BUSINESS_NAME', 'Rossmann Coffee Shop')}")
    print(f"📍 Location: {os.getenv('BUSINESS_LOCATION', 'Katunayake / Negombo, Sri Lanka')}")
    yield
    print("👋 Shutting down API...")


app = FastAPI(
    title="Context-Aware Forecasting System",
    description="AI-powered coffee shop management assistant using CrewAI",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration - allow frontend to connect
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


@app.get("/", response_model=HealthResponse)
async def root():
    """Root endpoint - health check."""
    return HealthResponse(
        status="ok",
        message="Context-Aware Forecasting API is running"
    )


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="ok",
        message="API is healthy"
    )


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Chat endpoint - process a message from the manager.
    
    The frontend sends:
    - message: The user's current message
    - conversation_history: Previous messages (frontend maintains this)
    
    Returns:
    - response: The assistant's response
    - agents_used: Which agents were called
    - reasoning_steps: How each agent contributed
    - routing_reasoning: Why these agents were chosen
    """
    try:
        response = process_chat_message(
            message=request.message,
            conversation_history=request.conversation_history
        )
        return response
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing message: {str(e)}"
        )


# Entry point for running with uvicorn
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "contextawareforecastingsys.api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
