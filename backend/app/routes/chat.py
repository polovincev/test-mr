from __future__ import annotations

from typing import List, Literal

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
    mode: Literal["goal", "direct", "profile_goal"] = "goal"
    first_user_prompt: str | None = None


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

    if data.mode == "goal":
        # Стартовое приветствие от ассистента
        try:
            import os
            from openai import OpenAI  # type: ignore
            from app.prompts.loader import load_prompt  # type: ignore

            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise RuntimeError("OPENAI_API_KEY not set")

            client = OpenAI(api_key=api_key)
            system_prompt = load_prompt("smart_goal_system")

            completion = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": "Начни диалог приветствием и предложением помочь сформулировать учебную цель, дальше веди диалог используя системный промпт, в приветствии добавляй имя Дарья",
                    },
                ],
            )

            assistant_start = (
                completion.choices[0].message.content.strip()
                if completion.choices and completion.choices[0].message.content
                else None
            )
            if not assistant_start:
                raise RuntimeError("empty completion")

        except Exception as e:
            print("Error generating first chat message", e)
            assistant_start = "Максим, привет! Давай определимся с твоей учебной целью. Что ты хочешь сделать?"

        await repo.add_message(chat.id, ChatMessage(role="assistant", content=assistant_start))

    elif data.mode == "profile_goal":
        # Режим "рассказать о себе": приветствие и предложение рассказать о себе (профиль)
        try:
            import os
            from openai import OpenAI  # type: ignore
            from app.prompts.loader import load_prompt  # type: ignore

            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise RuntimeError("OPENAI_API_KEY not set")

            client = OpenAI(api_key=api_key)
            system_prompt = load_prompt("profile_system")

            completion = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": "Начни диалог приветствием и предложением рассказать о себе, дальше веди диалог используя системный промпт, в приветствии добавляй имя Дарья",
                    },
                ],
            )

            assistant_start = (
                completion.choices[0].message.content.strip()
                if completion.choices and completion.choices[0].message.content
                else None
            )
            if not assistant_start:
                raise RuntimeError("empty completion")

        except Exception as e:
            print("Error generating profile start", e)
            assistant_start = "Привет! Давай познакомимся. Расскажи немного о себе, интересах и учебных целях."

        await repo.add_message(chat.id, ChatMessage(role="assistant", content=assistant_start))

    elif data.mode == "direct" and data.first_user_prompt:
        # Первое сообщение от пользователя, затем ответ ассистента с системным промтом
        await repo.add_message(chat.id, ChatMessage(role="user", content=data.first_user_prompt))
        try:
            import os
            from openai import OpenAI  # type: ignore
            from app.prompts.loader import load_prompt  # type: ignore

            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise RuntimeError("OPENAI_API_KEY not set")

            client = OpenAI(api_key=api_key)
            system_prompt = load_prompt("smart_goal_system")
            completion = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": data.first_user_prompt},
                ],
            )
            assistant_reply = (
                completion.choices[0].message.content.strip()
                if completion.choices and completion.choices[0].message.content
                else None
            )
            if not assistant_reply:
                raise RuntimeError("empty completion")
            await repo.add_message(chat.id, ChatMessage(role="assistant", content=assistant_reply))
        except Exception as e:
            print("Error generating direct response", e)
            await repo.add_message(chat.id, ChatMessage(role="assistant", content="Понял ваш запрос. Давайте теперь сформулируем вашу учебную цель!"))

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

    # --- Генерируем ответ ассистента через LLM на основе всей истории ---
    try:
        import os
        from openai import OpenAI  # type: ignore

        from app.prompts.loader import load_prompt  # type: ignore

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY not set")

        client = OpenAI(api_key=api_key)

        chat_full = await repo.get_chat(chat_id)
        assert chat_full is not None

        # Преобразуем историю в формат OpenAI messages
        history_messages = [
            {"role": m.role, "content": m.content} for m in chat_full.messages
        ]

        system_prompt = load_prompt("smart_goal_system")

        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "system", "content": system_prompt}] + history_messages
        )
        assistant_reply = (
            completion.choices[0].message.content.strip()
            if completion.choices and completion.choices[0].message.content
            else None
        )
        if not assistant_reply:
            raise RuntimeError("empty completion")

    except Exception as e:
        # Fallback fixed answer on error
        print("Error generating chat response", e)
        assistant_reply = "Принято. Давай продолжим!"

    await repo.add_message(chat_id, ChatMessage(role="assistant", content=assistant_reply))
    chat = await repo.get_chat(chat_id)
    assert chat is not None
    return chat


@router.get("/{chat_id}", response_model=Chat)
async def get_chat(chat_id: int, repo: ChatRepository = Depends(get_chat_repo)) -> Chat:
    chat = await repo.get_chat(chat_id)
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat


