from __future__ import annotations

from typing import List, Literal

from ..entities.chat import Chat, ChatMessage
from .chat_repository import ChatRepository


class InMemoryChatRepository(ChatRepository):
    def __init__(self) -> None:
        self._chats: List[Chat] = []
        self._next_id: int = 1

    async def list_chats(self) -> List[Chat]:
        return list(self._chats)

    async def create_chat(self, title: str, mode: Literal["goal", "direct", "profile_goal"] = "goal") -> Chat:
        chat = Chat(id=self._next_id, title=title, mode=mode)
        self._next_id += 1
        self._chats.append(chat)
        # Keep only the last 10 chats to save memory
        if len(self._chats) > 10:
            # Drop the oldest chats
            overflow = len(self._chats) - 10
            self._chats = self._chats[overflow:]
        return chat

    async def add_message(self, chat_id: int, message: ChatMessage) -> Chat:
        chat = await self.get_chat(chat_id)
        if chat is None:
            raise ValueError("Chat not found")
        chat.messages.append(message)
        return chat

    async def get_chat(self, chat_id: int) -> Chat | None:
        return next((c for c in self._chats if c.id == chat_id), None)


