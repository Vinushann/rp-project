import os
from io import BytesIO

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv

from app.schemas import PingResponse
from app.modules.vinushan.contextawareforecastingsys.api.chat_service import (
    process_chat_message,
)
from app.modules.vinushan.contextawareforecastingsys.api.realtime_streaming import (
    stream_chat_realtime,
)
from app.modules.vinushan.contextawareforecastingsys.api.models import (
    ChatRequest,
    ChatResponse,
)

load_dotenv()


class TTSRequest(BaseModel):
    """Request model for text-to-speech."""
    text: str
    voice: str = "nova"  # Options: alloy, echo, fable, onyx, nova, shimmer

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
    - run_start: Processing begins
    - query_analysis: Routing decision with agents needed
    - agent_start: Agent beginning work
    - tool_start: Tool being invoked
    - tool_result: Tool completed with results
    - agent_output: Intermediate agent output
    - agent_end: Agent finished work
    - run_end: Complete response with all data
    - error: Error occurred
    """
    return StreamingResponse(
        stream_chat_realtime(
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


@router.post("/tts")
async def text_to_speech(request: TTSRequest):
    """
    Convert text to natural-sounding speech using OpenAI's TTS API.
    Returns audio/mpeg stream for playback.
    
    Available voices: alloy, echo, fable, onyx, nova, shimmer
    - nova: Warm, engaging female voice (default)
    - alloy: Neutral, balanced voice
    - echo: Warm male voice
    - fable: Expressive, storytelling voice
    - onyx: Deep, authoritative male voice
    - shimmer: Clear, friendly female voice
    """
    try:
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
        # Limit text length to avoid excessive API costs
        text = request.text[:4000] if len(request.text) > 4000 else request.text
        
        response = client.audio.speech.create(
            model="tts-1",  # Use tts-1-hd for higher quality (more expensive)
            voice=request.voice,
            input=text,
            response_format="mp3",
        )
        
        # Stream the audio response
        audio_buffer = BytesIO(response.content)
        
        return StreamingResponse(
            audio_buffer,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline",
                "Cache-Control": "no-cache",
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")
