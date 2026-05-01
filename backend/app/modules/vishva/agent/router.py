"""
Agent Router
============
FastAPI endpoints for the agentic menu intelligence system.
These are mounted alongside (not replacing) the existing vishva endpoints.
"""

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
import json
import os

router = APIRouter()


# ============================================
# SCHEMAS
# ============================================

class AgentChatRequest(BaseModel):
    """Request to chat with the menu agent"""
    message: str
    session_id: Optional[str] = "default"

class AgentChatResponse(BaseModel):
    """Response from the menu agent"""
    reply: str
    tools_used: List[str] = []
    steps: Optional[list] = None
    session_id: Optional[str] = None


# ============================================
# ENDPOINTS
# ============================================

@router.get("/ping")
async def agent_ping():
    """Health check for the agent subsystem."""
    try:
        from .menu_agent import MenuAgent
        # Just verify import works — don't instantiate yet
        model = os.getenv('VISHVA_OLLAMA_MODEL', 'qwen2.5:7b')
        return {"status": "ok", "agent": "menu-intelligence", "llm": f"{model} (local)"}
    except ImportError as e:
        return {"status": "error", "message": f"Agent dependencies not installed: {e}"}


@router.post("/chat", response_model=AgentChatResponse)
async def agent_chat(request: AgentChatRequest):
    """
    Chat with the Menu Intelligence Agent.

    The agent autonomously decides which tools to use based on your message.

    Examples:
    - "Extract menu from https://tilapiyacolombo.lk/menu/"
    - "What's the current model status?"
    - "What category is Chicken Kottu?"
    - "Train the classifier"
    - "Show me the menu data"
    - "Process this restaurant: https://example.com/menu"
    """
    from .menu_agent import MenuAgent

    # Use default local ollama model unless overridden in environment
    model = os.getenv('VISHVA_OLLAMA_MODEL', 'qwen2.5:7b')
    base_url = os.getenv('OLLAMA_URL', 'http://localhost:11434')
    agent = MenuAgent(model=model, base_url=base_url)
    result = await agent.ainvoke(request.message, thread_id=request.session_id or "default")

    return AgentChatResponse(
        reply=result["reply"],
        tools_used=result["tools_used"],
        steps=result["steps"],
        session_id=request.session_id,
    )


@router.get("/chat-stream")
async def agent_chat_stream(message: str, session_id: str = "default", llm: Optional[str] = None):
    """
    Stream the agent's reasoning and tool usage in real-time via Server-Sent Events.

    Each event has a 'type' field:
    - thought: agent reasoning text chunk
    - tool_start: agent is calling a tool
    - tool_result: tool returned a result
    - done: agent finished
    """
    from .menu_agent import MenuAgent

    use_local = llm and llm.lower() in ('ollama', 'local', 'local-ollama')

    # Determine LLM selection. If client requests 'ollama' or 'local', use local Ollama settings.
    if use_local:
        model = os.getenv('VISHVA_OLLAMA_MODEL', 'qwen2.5:7b')
        base_url = os.getenv('OLLAMA_URL', 'http://localhost:11434')
        agent = MenuAgent(model=model, base_url=base_url)
    else:
        # Fallback to default agent configuration (still uses Ollama by default)
        model = os.getenv('VISHVA_OLLAMA_MODEL', 'qwen2.5:7b')
        base_url = os.getenv('OLLAMA_URL', 'http://localhost:11434')
        agent = MenuAgent(model=model, base_url=base_url)

    async def generate():
        prev_extract_llm = os.getenv("VISHVA_EXTRACT_LLM")
        os.environ["VISHVA_EXTRACT_LLM"] = "ollama" if use_local else "auto"

        try:
            async for event in agent.astream(message, thread_id=session_id):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        finally:
            if prev_extract_llm is None:
                os.environ.pop("VISHVA_EXTRACT_LLM", None)
            else:
                os.environ["VISHVA_EXTRACT_LLM"] = prev_extract_llm

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
