from __future__ import annotations

from typing import List, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..entities.chat import Chat, ChatMessage, Suggestion
from ..repositories.chat_repository import ChatRepository
from ..repositories.in_memory_chat_repository import InMemoryChatRepository
from ..repositories.context_store import upsert_goal, upsert_profile


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


# --- Helpers ---
def _build_suggestions(mode: str, content: str) -> List[Suggestion]:
    suggestions: List[Suggestion] = []
    has_fix_goal = "[COMMAND:FIX_GOAL]" in content
    has_profile_done = "[COMMAND:PROFILE_DONE]" in content

    if mode in ("goal", "direct"):
        if has_fix_goal:
            suggestions.extend([
                Suggestion(label="Посмотреть траекторию", action="redirect", href="/trajectory"),
                Suggestion(label="Ответить на вопросы", action="send_message", message="Ответить на вопросы"),
            ])
        if has_profile_done:
            suggestions.append(Suggestion(label="К траектории", action="redirect", href="/trajectory"))
    elif mode == "profile_goal":
        if has_fix_goal:
            suggestions.append(Suggestion(label="К траектории", action="redirect", href="/trajectory"))

    return suggestions


@router.post("/", response_model=Chat)
async def create_chat(data: ChatCreateIn, repo: ChatRepository = Depends(get_chat_repo)) -> Chat:
    chat = await repo.create_chat(title=data.title, mode=data.mode)

    if data.mode in ("goal", "profile_goal"):
        # Стартовое приветствие от ассистента под единый промпт
        try:
            import os
            from openai import OpenAI  # type: ignore
            from app.prompts.loader import load_prompt  # type: ignore

            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise RuntimeError("OPENAI_API_KEY not set")

            client = OpenAI(api_key=api_key)
            system_prompt = load_prompt("goal_system")

            order_text = (
                "Сначала выполни функцию GOAL, затем PROFILE."
                if data.mode == "goal"
                else "Сначала выполни функцию PROFILE, затем GOAL."
            )

            user_instruction = (
                "Начни диалог приветствием и предложением помочь сформулировать учебную цель, дальше веди диалог используя системный промпт, в приветствии добавляй имя Дарья."
                + order_text
                if data.mode == "goal"
                else "Начни диалог приветствием и предложением рассказать о себе, дальше веди диалог используя системный промпт, в приветствии добавляй имя Дарья."
                + order_text
            )

            completion = client.chat.completions.create(
                model="gpt-5-chat-latest",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_instruction},
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
            assistant_start = (
                "Максим, привет! Давай определимся с твоей учебной целью. Что ты хочешь сделать?"
                if data.mode == "goal"
                else "Привет! Давай познакомимся. Расскажи немного о себе, интересах и учебных целях."
            )

        suggestions = _build_suggestions(data.mode, assistant_start)
        await repo.add_message(chat.id, ChatMessage(role="assistant", content=assistant_start, suggestions=suggestions))

    elif data.mode == "direct" and data.first_user_prompt:
        # Первое сообщение от пользователя, потом 2 ответа ассистента:
        # 1) подробный ответ на запрос без запуска функций
        # 2) старт работы по единому промту (GOAL -> PROFILE)
        await repo.add_message(chat.id, ChatMessage(role="user", content=data.first_user_prompt))
        try:
            import os
            from openai import OpenAI  # type: ignore
            from app.prompts.loader import load_prompt  # type: ignore

            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise RuntimeError("OPENAI_API_KEY not set")

            client = OpenAI(api_key=api_key)

            # 1) Подробный ответ на пользовательский запрос без запуска функций
            first_completion = client.chat.completions.create(
                model="gpt-5-chat-latest",
                messages=[
                    {
                        "role": "system",
                        "content": "Ты полезный ассистент. Ответь подробно на первое сообщение пользователя. Не начинай функции GOAL и PROFILE и не добавляй технические теги, в приветствии добавляй имя Дарья.",
                    },
                    {"role": "user", "content": data.first_user_prompt},
                ],
            )
            first_reply = (
                first_completion.choices[0].message.content.strip()
                if first_completion.choices and first_completion.choices[0].message.content
                else None
            )
            if not first_reply:
                raise RuntimeError("empty completion (first reply)")
            first_suggestions = _build_suggestions("direct", first_reply)
            await repo.add_message(chat.id, ChatMessage(role="assistant", content=first_reply, suggestions=first_suggestions))

            # 2) Старт работы по системному промту c порядком GOAL -> PROFILE
            system_prompt = load_prompt("goal_system")
            order_text = "Сначала выполни функцию GOAL, затем PROFILE."

            updated_chat = await repo.get_chat(chat.id)
            assert updated_chat is not None
            updated_history = [
                {"role": m.role, "content": m.content} for m in updated_chat.messages
            ]

            second_completion = client.chat.completions.create(
                model="gpt-5-chat-latest",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": "Теперь начни вести диалог согласно системному промту. " + order_text},
                ]
                + updated_history,
            )
            second_reply = (
                second_completion.choices[0].message.content.strip()
                if second_completion.choices and second_completion.choices[0].message.content
                else None
            )
            if second_reply:
                second_suggestions = _build_suggestions("direct", second_reply)
                await repo.add_message(chat.id, ChatMessage(role="assistant", content=second_reply, suggestions=second_suggestions))
        except Exception as e:
            print("Error handling direct mode two-step flow", e)
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

        # Единый системный промт + указание порядка функций через пользовательскую инструкцию
        from app.prompts.loader import load_prompt  # type: ignore

        system_prompt = load_prompt("goal_system")
        mode = chat_full.mode
        order_text = (
            "Сначала выполни функцию GOAL, затем PROFILE."
            if mode in ("goal", "direct")
            else "Сначала выполни функцию PROFILE, затем GOAL."
        )

        # Преобразуем историю в формат OpenAI messages
        history_messages = [
            {"role": m.role, "content": m.content} for m in chat_full.messages
        ]

        completion = client.chat.completions.create(
            model="gpt-5-chat-latest",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": order_text},
            ]
            + history_messages,
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

    # 1) Добавляем первичный ответ ассистента
    suggestions = _build_suggestions(chat_full.mode, assistant_reply)
    await repo.add_message(chat_id, ChatMessage(role="assistant", content=assistant_reply, suggestions=suggestions))

    # 1.1) Попробуем извлечь GOAL и PROFILE из ответа и сохранить в контекст
    try:
        import json, re
        # [GOAL: ...]
        m_goal = re.search(r"\[GOAL:(.*?)\]", assistant_reply, flags=re.DOTALL)
        if m_goal:
            upsert_goal(chat_id, m_goal.group(1).strip())
        # [PROFILE:{...}]
        m_prof = re.search(r"\[PROFILE:(\{[\s\S]*?\})\]", assistant_reply, flags=re.DOTALL)
        if m_prof:
            prof_raw = m_prof.group(1)
            try:
                prof = json.loads(prof_raw)
                if isinstance(prof, dict):
                    upsert_profile(chat_id, prof)
            except Exception:
                pass
    except Exception:
        pass

    # 2) Дополнительная генерация больше не требуется, единый промт обрабатывает теги внутри диалога

    chat = await repo.get_chat(chat_id)
    assert chat is not None
    return chat


@router.get("/{chat_id}", response_model=Chat)
async def get_chat(chat_id: int, repo: ChatRepository = Depends(get_chat_repo)) -> Chat:
    chat = await repo.get_chat(chat_id)
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat


