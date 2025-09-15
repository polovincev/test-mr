from __future__ import annotations

from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.prompts.loader import load_prompt
from app.repositories.context_store import (
    get_trajectory,
    get_context,
    get_summary_messages,
    append_summary_message,
    clear_summary_messages,
)

router = APIRouter(prefix="/summary_chat", tags=["summary_chat"])


class SummaryMessage(BaseModel):
    role: str
    content: str


class SummaryChatOut(BaseModel):
    chat_id: int
    messages: List[SummaryMessage]


def _build_user_context_block(chat_id: int) -> str:
    # Context: goal + passed tasks (prefer cached tasks in ctx["tasks"], fallback to trajectory)
    ctx = get_context(chat_id)
    goal_text = ""
    try:
        if isinstance(ctx, dict) and ctx.get("goal"):
            goal_text = str(ctx.get("goal") or "").strip()
    except Exception:
        goal_text = ""

    passed_titles: List[str] = []
    # 1) From cached tasks in context
    try:
        tasks_by_topic = ctx.get("tasks") if isinstance(ctx, dict) else None
        if isinstance(tasks_by_topic, dict):
            for _, payload in tasks_by_topic.items():
                try:
                    tasks = (payload or {}).get("tasks") if isinstance(payload, dict) else None
                    if isinstance(tasks, list):
                        for t in tasks:
                            try:
                                title = str(getattr(t, "title", "") or (t.get("title") if isinstance(t, dict) else ""))
                                is_passed = bool(getattr(t, "passed", False) or (t.get("passed") if isinstance(t, dict) else False))
                                if is_passed and title and "тест по базовому уровню" not in title.lower():
                                    passed_titles.append(title)
                            except Exception:
                                continue
                except Exception:
                    continue
    except Exception:
        pass

    # 2) Fallback: from trajectory object if nothing in cache
    if not passed_titles:
        traj = get_trajectory(chat_id)
        try:
            if traj and isinstance(traj, dict):
                items = traj.get("items") or []
                for it in items:
                    try:
                        skills = it.get("skills") or {}
                        levels = skills.get("levels") or []
                        for lvl in levels:
                            for t in (lvl.get("tasks") or []):
                                title = str(t.get("title") or "")
                                is_passed = bool(t.get("passed"))
                                if is_passed and title and "тест по базовому уровню" not in title.lower():
                                    passed_titles.append(title)
                    except Exception:
                        continue
        except Exception:
            passed_titles = []

    lines = "\n".join(f"- {t}" for t in passed_titles) if passed_titles else "- пока нет завершённых заданий"
    goal_line = f"Цель пользователя: {goal_text}\n" if goal_text else ""
    return (
        "\n[USER_CONTEXT]\n" + goal_line + "Пользователь выполнил следующие задания:\n" + lines + "\n[/USER_CONTEXT]"
    )


async def _llm_reply(system_prompt: str, messages: List[SummaryMessage]) -> str:
    import os
    from openai import OpenAI  # type: ignore
    import asyncio

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set")

    client = OpenAI(api_key=api_key)

    converted = [{"role": m.role, "content": m.content} for m in messages]

    print(system_prompt)

    completion = await asyncio.to_thread(
        client.chat.completions.create,
        model="gpt-5-chat-latest",
        messages=[
            {"role": "system", "content": system_prompt},
            *converted,
        ],
    )
    content = completion.choices[0].message.content if completion.choices else None
    if not content:
        raise RuntimeError("empty completion")
    return content.strip()


@router.post("/start", response_model=SummaryChatOut)
async def start_summary_chat(chat_id: int) -> SummaryChatOut:  # noqa: D401
    """Start a summary chat: assistant sends the first message based on system prompt and user study progress."""
    clear_summary_messages(chat_id)
    system = load_prompt("summary_agent_system")
    user_block = _build_user_context_block(chat_id)
    system_with_ctx = system + user_block
    history: List[SummaryMessage] = []
    # Seed with a short instruction for the assistant to greet and ask a question
    seed = SummaryMessage(role="user", content="Сделай приветствие учитывая прогресс пользователя и начни короткий диалог по учебному прогрессу.")
    history.append(seed)
    reply = await _llm_reply(system_with_ctx, history)
    append_summary_message(chat_id, "assistant", reply)
    return SummaryChatOut(chat_id=chat_id, messages=[SummaryMessage(role="assistant", content=reply)])


class SendIn(BaseModel):
    chat_id: int
    content: str


@router.post("/message", response_model=SummaryChatOut)
async def send_summary_message(data: SendIn) -> SummaryChatOut:  # noqa: D401
    """Append a user message and return updated chat with assistant reply."""
    msgs = get_summary_messages(data.chat_id)
    system = load_prompt("summary_agent_system")
    user_block = _build_user_context_block(data.chat_id)
    system_with_ctx = system + user_block

    # Build conversation: existing messages + new user message (+ progress block once)
    history: List[SummaryMessage] = []
    for m in msgs:
        history.append(SummaryMessage(role=m.get("role", "assistant"), content=str(m.get("content", ""))))
    history.append(SummaryMessage(role="user", content=(data.content or "")))

    reply = await _llm_reply(system_with_ctx, history)

    append_summary_message(data.chat_id, "user", data.content)
    append_summary_message(data.chat_id, "assistant", reply)

    all_msgs = get_summary_messages(data.chat_id)
    out = [SummaryMessage(role=m.get("role"), content=str(m.get("content", ""))) for m in all_msgs]
    return SummaryChatOut(chat_id=data.chat_id, messages=out)