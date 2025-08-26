from __future__ import annotations

from typing import List, Protocol, Literal

from ..entities.chat import Chat, ChatMessage


class ChatRepository(Protocol):
    async def list_chats(self) -> List[Chat]:
        ...

    async def create_chat(self, title: str, mode: Literal["goal", "direct", "profile_goal"] = "goal") -> Chat:
        ...

    async def add_message(self, chat_id: int, message: ChatMessage) -> Chat:
        ...

    async def get_chat(self, chat_id: int) -> Chat | None:
        ...


