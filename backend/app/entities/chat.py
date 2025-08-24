from __future__ import annotations

from datetime import datetime
from typing import Literal, List

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class Chat(BaseModel):
    id: int
    title: str
    messages: List[ChatMessage] = Field(default_factory=list)


