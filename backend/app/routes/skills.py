from __future__ import annotations

from typing import List

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/skills", tags=["skills"])


class SkillItem(BaseModel):
    name: str
    level: int
    description: str | None = None


class SkillsResponse(BaseModel):
    items: List[SkillItem]


SYSTEM_PROMPT_NAME = "skills_system"
STATIC_USER_PROMPT = "Цель пользователя: Подготовиться за месяц к экзамену по механике и сдать его на отлично"


@router.get("/", response_model=SkillsResponse)
async def get_skills() -> SkillsResponse:  # noqa: D401
    """Return radar skills generated via LLM or fallback static list."""
    import os, json, re

    from app.prompts.loader import load_prompt  # type: ignore

    api_key = os.getenv("OPENAI_API_KEY")
    system_prompt = load_prompt(SYSTEM_PROMPT_NAME)

    fallback = SkillsResponse(
        items=[
            SkillItem(name="Кинематика", level=3, description="Описание"),
            SkillItem(name="Динамика", level=2, description="Описание"),
            SkillItem(name="Статика", level=4, description="Описание"),
            SkillItem(name="Теория колебаний", level=1, description="Описание"),
            SkillItem(name="Сопротивление материалов", level=2, description="Описание"),
        ]
    )

    if not api_key:
        return fallback

    try:
        from openai import OpenAI  # type: ignore

        client = OpenAI(api_key=api_key)
        completion = client.chat.completions.create(
            model="gpt-5-chat-latest",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": STATIC_USER_PROMPT},
            ],
        )
        content = completion.choices[0].message.content if completion.choices else None
        if not content:
            raise RuntimeError("empty completion")

        def parse_json(txt: str):
            try:
                data = json.loads(txt)
                if isinstance(data, dict):
                    # Accept wrapper keys like "items" or "skills"
                    if "items" in data and isinstance(data["items"], list):
                        data = data["items"]
                    elif "skills" in data and isinstance(data["skills"], list):
                        data = data["skills"]
                if isinstance(data, list):
                    items: list[SkillItem] = []
                    for d in data:
                        if isinstance(d, dict) and "name" in d and "level" in d:
                            lvl = int(float(d["level"])) if isinstance(d["level"], str) else int(d["level"])
                            items.append(
                                SkillItem(
                                    name=str(d["name"]),
                                    level=lvl,
                                    description=d.get("description"),
                                )
                            )
                    return items if items else None
            except Exception:
                return None
            return None

        items = parse_json(content)
        if items is None:
            # try line parse: Name - level - desc
            items = []
            for line in content.splitlines():
                m = re.match(r"\s*(.+?)\s*[-:]\s*(\d+)\s*(?:[-:]\s*(.+))?", line)
                if m:
                    name = m.group(1).strip()
                    lvl = int(m.group(2))
                    desc = m.group(3).strip() if m.group(3) else None
                    items.append(SkillItem(name=name, level=lvl, description=desc))
        if not items:
            raise ValueError("Cannot parse skills")
        return SkillsResponse(items=items)
    except Exception as e:
        print("Error generating skills", e)
        return fallback
