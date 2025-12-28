from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.schemas import PingResponse
from app.modules.vinushan.contextawareforecastingsys.api.chat_service import (
    process_chat_message,
)
from app.modules.vinushan.contextawareforecastingsys.api.streaming_service import (
    stream_chat_response,
)
from app.modules.vinushan.contextawareforecastingsys.api.models import (
    ChatRequest,
    ChatResponse,
)

router = APIRouter()

MODULE_NAME = "vinushan"


@router.get("/ping", response_model=PingResponse)
async def ping():
    """Health check endpoint for Vinushan module."""
    return PingResponse(module=MODULE_NAME, status="ok")


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Handle chat requests using the context-aware forecasting system."""
    try:
        return process_chat_message(
            message=request.message,
            conversation_history=request.conversation_history,
        )
    except Exception as exc:  # pragma: no cover - surfaced to client
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """
    Handle chat requests with real-time streaming updates.
    Returns Server-Sent Events (SSE) for progressive reasoning display.
    
    Events emitted:
    - status: Processing status messages
    - routing: Routing decision with agents needed
    - agent_start: Agent beginning work
    - agent_complete: Agent finished with output
    - error: Error occurred
    - final_response: Complete response with all data
    """
    return StreamingResponse(
        stream_chat_response(
            message=request.message,
            conversation_history=request.conversation_history,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )


# ============================================
# ADD YOUR CUSTOM ENDPOINTS BELOW THIS LINE
# ============================================
