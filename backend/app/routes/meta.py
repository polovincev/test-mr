from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.prompts.loader import load_prompt
from app.repositories.context_store import get_context, get_meta_central, set_meta_central


router = APIRouter(prefix="/meta", tags=["meta"])


class MetaCentralRequest(BaseModel):
    chat_id: int


class MetaCentralResponse(BaseModel):
    chat_id: int
    content: str


@router.post("/central", response_model=MetaCentralResponse)
async def meta_central(req: MetaCentralRequest) -> MetaCentralResponse:  # noqa: D401
    """Return cached meta-central summary for chat_id or generate it via LLM.

    - Load trajectory from context by chat_id; collect item titles
    - If cached under 'meta_central', return cached
    - Else call LLM with system prompt 'meta_central_system' and user prompt as JSON array of titles
      then save to context and return
    """
    import os
    import json

    chat_id = int(req.chat_id)

    cached = get_meta_central(chat_id)
    if isinstance(cached, dict):
        try:
            if int(cached.get("chat_id", 0)) == chat_id and isinstance(cached.get("content"), str):
                return MetaCentralResponse(chat_id=chat_id, content=str(cached.get("content")))
        except Exception:
            pass
    if isinstance(cached, str):
        return MetaCentralResponse(chat_id=chat_id, content=cached)

    ctx = get_context(chat_id)
    trajectory = ctx.get("trajectory") if isinstance(ctx, dict) else None
    titles: list[str] = []
    try:
        if trajectory and isinstance(trajectory, dict):
            for it in trajectory.get("items", []) or []:
                try:
                    title = str(it.get("title", "")).strip()
                    if title:
                        titles.append(title)
                except Exception:
                    continue
        elif trajectory and hasattr(trajectory, "items"):
            for it in getattr(trajectory, "items", []) or []:
                try:
                    title = str(getattr(it, "title", "")).strip()
                    if title:
                        titles.append(title)
                except Exception:
                    continue
    except Exception:
        titles = []

    if not titles:
        return MetaCentralResponse(chat_id=chat_id, content="")

    try:
        user_prompt = json.dumps({"titles": titles}, ensure_ascii=False)
    except Exception:
        user_prompt = ", ".join(titles)

    system_prompt = load_prompt("meta_central_system")
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return MetaCentralResponse(chat_id=chat_id, content="")

    try:
        from openai import OpenAI  # type: ignore
        client = OpenAI(api_key=api_key)
        comp = client.chat.completions.create(
            model="gpt-5-chat-latest",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        content = comp.choices[0].message.content if comp.choices else ""
    except Exception:
        content = ""

    payload = {"chat_id": chat_id, "content": str(content or "").strip()}
    try:
        set_meta_central(chat_id, payload)
    except Exception:
        pass
    return MetaCentralResponse(**payload)


