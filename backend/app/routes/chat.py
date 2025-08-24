from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..entities.chat import Chat, ChatMessage
from ..repositories.chat_repository import ChatRepository
from ..repositories.in_memory_chat_repository import InMemoryChatRepository


router = APIRouter(prefix="/chat", tags=["chat"])


async def get_chat_repo() -> ChatRepository:
    # In a real app use DI container; here we create a singleton-ish instance
    # and keep it on the router object
    if not hasattr(router, "_repo"):
        router._repo = InMemoryChatRepository()  # type: ignore[attr-defined]
    return router._repo  # type: ignore[attr-defined]


class ChatOut(BaseModel):
    id: int
    title: str


class ChatCreateIn(BaseModel):
    title: str


class MessageIn(BaseModel):
    role: str
    content: str


@router.get("/", response_model=List[ChatOut])
async def list_chats(repo: ChatRepository = Depends(get_chat_repo)) -> List[ChatOut]:
    chats = await repo.list_chats()
    return [ChatOut(id=c.id, title=c.title) for c in chats]


@router.post("/", response_model=Chat)
async def create_chat(data: ChatCreateIn, repo: ChatRepository = Depends(get_chat_repo)) -> Chat:
    chat = await repo.create_chat(title=data.title)
    # Добавляем стартовое сообщение ассистента
    await repo.add_message(chat.id, ChatMessage(role="assistant", content="Максим, привет! Давай определимся с твоей учебной целью. Что ты хочешь сделать?"))
    # Возвращаем весь чат с сообщениями
    chat_full = await repo.get_chat(chat.id)
    assert chat_full is not None
    return chat_full


@router.post("/{chat_id}/message")
async def add_message(chat_id: int, data: MessageIn, repo: ChatRepository = Depends(get_chat_repo)) -> Chat:
    chat = await repo.get_chat(chat_id)
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    # Добавляем сообщение пользователя
    await repo.add_message(chat_id, ChatMessage(role=data.role, content=data.content))
    # Фиксированный ответ ассистента
    await repo.add_message(chat_id, ChatMessage(role="assistant", content="Принято. Давай продолжим!"))
    chat = await repo.get_chat(chat_id)
    assert chat is not None
    return chat


@router.get("/{chat_id}", response_model=Chat)
async def get_chat(chat_id: int, repo: ChatRepository = Depends(get_chat_repo)) -> Chat:
    chat = await repo.get_chat(chat_id)
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat


