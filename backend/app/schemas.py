"""
Shared Pydantic Schemas
=======================
Common request/response models used across all modules.
Team members can import these or create their own in their module folders.
"""

from pydantic import BaseModel
from typing import Optional


class PingResponse(BaseModel):
    """Response schema for ping endpoint"""
    module: str
    status: str


class ChatRequest(BaseModel):
    """Request schema for chat endpoint"""
    session_id: str
    message: str


class ChatResponse(BaseModel):
    """Response schema for chat endpoint"""
    reply: str
    session_id: str
    module: Optional[str] = None
