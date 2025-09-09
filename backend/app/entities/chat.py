from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Literal, List, Optional

from pydantic import BaseModel, Field


class Suggestion(BaseModel):
    label: str
    action: Literal["redirect", "send_message"]
    href: Optional[str] = None
    message: Optional[str] = None


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(ZoneInfo("Europe/Moscow")))
    suggestions: List[Suggestion] = Field(default_factory=list)


class Chat(BaseModel):
    id: int
    title: str
    mode: Literal["goal", "direct", "profile_goal"] = "goal"
    messages: List[ChatMessage] = Field(default_factory=list)


