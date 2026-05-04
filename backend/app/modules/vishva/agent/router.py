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
    try:
        from .menu_agent import MenuAgent
    except ImportError as e:
        async def error_gen():
            yield f"data: {json.dumps({'type': 'error', 'message': f'Agent dependencies not installed: {e}. Install langchain-ollama and langgraph.'})}\n\n"
        return StreamingResponse(error_gen(), media_type="text/event-stream")

    # Always use the local Ollama-backed agent
    model = os.getenv('VISHVA_OLLAMA_MODEL', 'qwen2.5:7b')
    base_url = os.getenv('OLLAMA_URL', 'http://localhost:11434')
    try:
        agent = MenuAgent(model=model, base_url=base_url)
    except Exception as e:
        async def error_gen():
            yield f"data: {json.dumps({'type': 'error', 'message': f'Failed to create agent: {type(e).__name__}: {e}'})}\n\n"
        return StreamingResponse(error_gen(), media_type="text/event-stream")

    async def generate():
        # Create a queue to collect events from the agent
        import asyncio
        queue = asyncio.Queue()

        # Task to run the agent and put events into the queue
        async def run_agent():
            try:
                async for event in agent.astream(message, thread_id=session_id):
                    await queue.put(event)
                await queue.put({"type": "done"})
            except Exception as e:
                import traceback
                error_detail = f"{type(e).__name__}: {str(e)}"
                print(f"[AGENT ERROR] {error_detail}")
                traceback.print_exc()
                await queue.put({"type": "error", "message": error_detail})

        agent_task = asyncio.create_task(run_agent())

        try:
            while True:
                try:
                    # Wait for an event with a timeout for heartbeat
                    event = await asyncio.wait_for(queue.get(), timeout=5.0)
                    yield f"data: {json.dumps(event)}\n\n"
                    if event.get("type") in ["done", "error"]:
                        break
                except asyncio.TimeoutError:
                    # Send a keepalive comment to keep the connection open
                    yield ": keepalive\n\n"
        finally:
            if not agent_task.done():
                agent_task.cancel()


    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
