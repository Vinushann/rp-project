"""
Pydantic models for API requests and responses.
No database - just simple data structures.
"""

from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, Field


class Message(BaseModel):
    """A single chat message."""
    role: Literal["user", "assistant"]
    content: str
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())


class ChatRequest(BaseModel):
    """Request body for chat endpoint."""
    message: str = Field(..., min_length=1, description="The user's message")
    conversation_history: List[Message] = Field(
        default_factory=list,
        description="Previous messages in the conversation (frontend maintains this)"
    )


class AgentStep(BaseModel):
    """A single agent's work in the pipeline."""
    agent_name: str
    task_name: str
    summary: Optional[str] = None
    output_preview: Optional[str] = None


class ChartData(BaseModel):
    """Data for a generated chart/visualization."""
    image: Optional[str] = Field(None, description="Base64-encoded PNG image")
    title: str = Field(default="", description="Chart title")
    explanation: str = Field(default="", description="Explanation of the chart")
    chart_data: Optional[dict] = Field(
        default=None,
        description="Structured data for interactive charts (labels/datasets/chart_type)",
    )


class ChatResponse(BaseModel):
    """Response from chat endpoint."""
    response: str
    agents_used: List[str] = Field(default_factory=list)
    reasoning_steps: List[AgentStep] = Field(default_factory=list)
    routing_reasoning: Optional[str] = None
    charts: List[ChartData] = Field(default_factory=list, description="Generated charts/visualizations")


class StreamEvent(BaseModel):
    """Server-Sent Event for real-time updates."""
    event_type: Literal["routing", "agent_start", "agent_complete", "final_response", "error"]
    data: dict = Field(default_factory=dict)


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    message: str
