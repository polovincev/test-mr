from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field


router = APIRouter(prefix="/trajectory", tags=["trajectory"])


class SkillRequirement(BaseModel):
    name: str
    recommended_level: int
    description: str | None = None


class TrajectoryItem(BaseModel):
    title: str
    description: str | None = None
    tags: str | None = None
    skills: SkillRequirement
    image_url: Optional[str] = Field(default=None, description="Preview image URL for the card")


SYSTEM_SKILLS = "skills_system"
SYSTEM_TRAJECTORY = "trajectory_system"
USER_GOAL = "Цель пользователя: Биология за 10 класс, подготовка к ЕГЭ"


@router.get("/", response_model=List[TrajectoryItem])
async def get_trajectory_list(mock: bool = Query(False)) -> List[TrajectoryItem]:  # noqa: D401
    """Генерирует траекторию: сперва скилы, затем элементы траектории, объединяет ответы.

    Если ключа нет или что-то пошло не так — возвращает пустой список.
    """
    import os, json

    from app.prompts.loader import load_prompt  # type: ignore

    # Static mock toggle via query (?mock=true) or env var TRAJECTORY_MOCK=1
    if mock or os.getenv("TRAJECTORY_MOCK") == "1":
        items: List[TrajectoryItem] = [
            TrajectoryItem(
                title="Кинематика: базовые законы движения",
                description="Разберёшь виды движения, графики и связи между S, V, a.",
                tags="kinematics motion velocity acceleration graphs",
                skills=SkillRequirement(name="Кинематика", recommended_level=3, description="Понимание базовых уравнений движения"),
            ),
            TrajectoryItem(
                title="Динамика Ньютона и силы",
                description="Научишься применять 3 закона Ньютона и раскладывать силы.",
                tags="dynamics force newton friction normal",
                skills=SkillRequirement(name="Динамика", recommended_level=2, description="Сумма сил и уравнения движения"),
            ),
            TrajectoryItem(
                title="Статика и равновесие",
                description="Условия равновесия, момент силы, центр масс.",
                tags="statics equilibrium torque lever center",
                skills=SkillRequirement(name="Статика", recommended_level=4, description="Условия равновесия тела"),
            ),
            TrajectoryItem(
                title="Колебания и резонанс",
                description="Свободные и вынужденные колебания, период, частота, фазовые диаграммы.",
                tags="oscillations resonance frequency amplitude phase",
                skills=SkillRequirement(name="Теория колебаний", recommended_level=1, description="Гармонические колебания"),
            ),
            TrajectoryItem(
                title="Сопротивление материалов основы",
                description="Напряжения, деформации, диаграммы растяжения, предел текучести.",
                tags="strength materials stress strain elastic",
                skills=SkillRequirement(name="Сопротивление материалов", recommended_level=2, description="Напряжённо-деформированное состояние"),
            ),
        ]
        # Enrich with images
        try:
            import httpx
            used_urls: set[str] = set()
            async with httpx.AsyncClient(timeout=15.0) as client:
                for idx, it in enumerate(items):
                    try:
                        resp = await client.post("http://158.160.19.226:8000/search", json={"text": it.tags, "top_k": 5})
                        resp.raise_for_status()
                        data = resp.json()
                        images = []
                        if isinstance(data, dict):
                            images = data.get("images") or data.get("results") or data.get("items") or []
                        elif isinstance(data, list):
                            images = data
                        urls: list[str] = []
                        for v in images:
                            if isinstance(v, str):
                                urls.append(v)
                            elif isinstance(v, dict):
                                u = v.get("url") or v.get("image") or v.get("link")
                                if isinstance(u, str):
                                    urls.append(u)
                        chosen: str | None = None
                        if urls:
                            candidate = urls[idx % len(urls)]
                            if candidate not in used_urls:
                                chosen = candidate
                        if chosen is None:
                            for u in urls:
                                if u not in used_urls:
                                    chosen = u
                                    break
                        if chosen is None and urls:
                            chosen = urls[0]
                        if isinstance(chosen, str):
                            it.image_url = chosen
                            used_urls.add(chosen)
                    except Exception:
                        pass
        except Exception:
            pass
        return items

    api_key = os.getenv("OPENAI_API_KEY")
    skills_prompt = load_prompt(SYSTEM_SKILLS)
    traj_prompt = load_prompt(SYSTEM_TRAJECTORY)

    if not api_key:
        return []

    try:
        from openai import OpenAI  # type: ignore

        client = OpenAI(api_key=api_key)

        # 1) Сгенерировать навыки
        skills_resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": skills_prompt},
                {"role": "user", "content": USER_GOAL},
            ],
        )
        skills_content = skills_resp.choices[0].message.content if skills_resp.choices else None
        if not skills_content:
            raise RuntimeError("empty skills completion")

        print(skills_content)

        def parse_skills(txt: str) -> list[dict]:
            try:
                data = json.loads(txt)
                if isinstance(data, dict) and "skills" in data and isinstance(data["skills"], list):
                    return data["skills"]
                if isinstance(data, list):
                    return data
            except Exception:
                return []
            return []

        skills_list = parse_skills(skills_content)
        skill_names = [str(s.get("name", "")).strip() for s in skills_list if s.get("name")]

        # 2) Сгенерировать траекторию (названия навыков + цель)
        trajectory_user = USER_GOAL + "\nНавыки: " + "; ".join(skill_names)
        traj_resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": traj_prompt},
                {"role": "user", "content": trajectory_user},
            ],
        )
        traj_content = traj_resp.choices[0].message.content if traj_resp.choices else None
        print("--------------------------------")
        print(traj_content)
        if not traj_content:
            raise RuntimeError("empty trajectory completion")

        def parse_traj(txt: str) -> list[dict]:
            try:
                data = json.loads(txt)
                if isinstance(data, list):
                    return data
                if isinstance(data, dict):
                    # support either {items:[...]} or {modules:[...]}
                    if "items" in data and isinstance(data["items"], list):
                        return data["items"]
                    if "modules" in data and isinstance(data["modules"], list):
                        return data["modules"]
            except Exception:
                return []
            return []

        traj_items_raw = parse_traj(traj_content)

        # 3) Сопоставить: для каждого элемента взять первый подходящий скил из списка
        items: list[TrajectoryItem] = []
        for it in traj_items_raw:
            title = str(it.get("title", "")).strip()
            if not title:
                continue
            description = str(it.get("description", "")).strip() or None
            # normalize tags: join array into a single space-separated string
            tags_raw = it.get("tags")
            tags_str: str | None = None
            if isinstance(tags_raw, list):
                try:
                    joined = " ".join(str(t).strip() for t in tags_raw if str(t).strip())
                    tags_str = joined or None
                except Exception:
                    tags_str = None
            elif isinstance(tags_raw, str):
                tags_str = tags_raw.strip() or None

            # exact mapping by module.skill → skills list; fallback to first skill
            target_skill_name = str(it.get("skill", "")).strip().lower()
            chosen_skill = None
            if target_skill_name:
                for s in skills_list:
                    s_name = str(s.get("name", "")).strip().lower()
                    if s_name == target_skill_name:
                        chosen_skill = s
                        break
            if chosen_skill is None and skills_list:
                chosen_skill = skills_list[0]

            if chosen_skill is None:
                # fallback minimal skill
                sr = SkillRequirement(name="Навык", recommended_level=1, description=None)
            else:
                lvl_raw = chosen_skill.get("level") or chosen_skill.get("recommended_level")
                try:
                    lvl_int = int(float(str(lvl_raw)))
                except Exception:
                    lvl_int = 1
                sr = SkillRequirement(
                    name=str(chosen_skill.get("name", "Навык")),
                    recommended_level=lvl_int,
                    description=(str(chosen_skill.get("description")) if chosen_skill.get("description") else None),
                )

            items.append(TrajectoryItem(title=title, description=description, tags=tags_str, skills=sr))

        # 4) Enrich items with images from external search
        try:
            import httpx
            used_urls: set[str] = set()
            async with httpx.AsyncClient(timeout=15.0) as client:
                for idx, it in enumerate(items):
                    try:
                        resp = await client.post("http://158.160.19.226:8000/search", json={"text": it.tags, "top_k": 5})
                        resp.raise_for_status()
                        data = resp.json()
                        images = []
                        if isinstance(data, dict):
                            images = data.get("images") or data.get("results") or data.get("items") or []
                        elif isinstance(data, list):
                            images = data
                        urls: list[str] = []
                        for v in images:
                            if isinstance(v, str):
                                urls.append(v)
                            elif isinstance(v, dict):
                                u = v.get("url") or v.get("image") or v.get("link")
                                if isinstance(u, str):
                                    urls.append(u)
                        chosen: str | None = None
                        if urls:
                            candidate = urls[idx % len(urls)]
                            if candidate not in used_urls:
                                chosen = candidate
                        if chosen is None:
                            for u in urls:
                                if u not in used_urls:
                                    chosen = u
                                    break
                        if chosen is None and urls:
                            chosen = urls[0]
                        if isinstance(chosen, str):
                            # update in-place since items are Pydantic models
                            for j, existing in enumerate(items):
                                if existing.title == it.title:
                                    items[j].image_url = chosen
                                    break
                            used_urls.add(chosen)
                    except Exception:
                        pass
        except Exception:
            pass

        return items
    except Exception as e:
        print("Error generating trajectory", e)
        return []


