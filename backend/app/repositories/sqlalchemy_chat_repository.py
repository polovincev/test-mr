from __future__ import annotations

from typing import List, Literal, Optional

from sqlalchemy.orm import Session

from ..models import Chat as ChatDB, ChatMessage as ChatMessageDB
from ..entities.chat import Chat as ChatDTO, ChatMessage as ChatMessageDTO
from .chat_repository import ChatRepository

DEFAULT_USER_ID = 1  # TODO: inject real user later


class SqlAlchemyChatRepository(ChatRepository):
    def __init__(self, db: Session) -> None:
        self._db = db

    async def list_chats(self) -> List[ChatDTO]:
        rows = (
            self._db.query(ChatDB)
            .filter(ChatDB.user_id == DEFAULT_USER_ID)
            .order_by(ChatDB.id.desc())
            .limit(20)
            .all()
        )
        return [ChatDTO(id=r.id, title=r.title, mode=r.mode, messages=[]) for r in rows]

    async def create_chat(self, title: str, mode: Literal["goal", "direct", "profile_goal"] = "goal") -> ChatDTO:
        row = ChatDB(user_id=DEFAULT_USER_ID, title=title, mode=mode)
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return ChatDTO(id=row.id, title=row.title, mode=row.mode, messages=[])

    async def add_message(self, chat_id: int, message: ChatMessageDTO) -> ChatDTO:
        chat = self._db.get(ChatDB, chat_id)
        if not chat or chat.user_id != DEFAULT_USER_ID:
            raise ValueError("Chat not found")
        msg = ChatMessageDB(
            chat_id=chat_id,
            user_id=DEFAULT_USER_ID,
            role=message.role,
            content=message.content,
        )
        self._db.add(msg)
        self._db.commit()
        return await self.get_chat(chat_id)  # type: ignore

    async def get_chat(self, chat_id: int) -> Optional[ChatDTO]:
        chat = self._db.get(ChatDB, chat_id)
        if not chat or chat.user_id != DEFAULT_USER_ID:
            return None
        messages = [
            ChatMessageDTO(role=m.role, content=m.content, timestamp=m.created_at)
            for m in chat.messages
        ]
        return ChatDTO(id=chat.id, title=chat.title, mode=chat.mode, messages=messages)
