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
    # Collect passed tasks from trajectory in context
    traj = get_trajectory(chat_id)
    passed_titles: List[str] = []
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
                            if is_passed:
                                passed_titles.append(title)
                except Exception:
                    continue
    except Exception:
        passed_titles = []
    if not passed_titles:
        return ""
    lines = "\n".join(f"- {t}" for t in passed_titles)
    return f"\n[USER_LEARN_PROGRESS]\nПользователь выполнил следующие задания:\n{lines}\n[/USER_LEARN_PROGRESS]"


async def _llm_reply(system_prompt: str, messages: List[SummaryMessage]) -> str:
    import os
    from openai import OpenAI  # type: ignore
    import asyncio

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set")

    client = OpenAI(api_key=api_key)

    converted = [{"role": m.role, "content": m.content} for m in messages]
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
    history: List[SummaryMessage] = []
    # Seed with a short instruction for the assistant to greet and ask a question
    seed = SummaryMessage(role="user", content="Сделай приветствие и начни короткий диалог по учебному прогрессу." + user_block)
    history.append(seed)
    reply = await _llm_reply(system, history)
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

    # Build conversation: existing messages + new user message (+ progress block once)
    history: List[SummaryMessage] = []
    for m in msgs:
        history.append(SummaryMessage(role=m.get("role", "assistant"), content=str(m.get("content", ""))))
    history.append(SummaryMessage(role="user", content=(data.content or "") + user_block))

    reply = await _llm_reply(system, history)

    append_summary_message(data.chat_id, "user", data.content)
    append_summary_message(data.chat_id, "assistant", reply)

    all_msgs = get_summary_messages(data.chat_id)
    out = [SummaryMessage(role=m.get("role"), content=str(m.get("content", ""))) for m in all_msgs]
    return SummaryChatOut(chat_id=data.chat_id, messages=out)