from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field


router = APIRouter(prefix="/trajectory", tags=["trajectory"])


class TaskInfo(BaseModel):
    title: str
    description: str | None = None


class LevelInfo(BaseModel):
    level: int
    level_name: str | None = None
    meta: str | None = None
    description: str | None = None
    tasks: list[TaskInfo] = Field(default_factory=list)


class SkillRequirement(BaseModel):
    name: str
    recommended_level: int
    recommended_level_text: str | None = None
    levels: list[LevelInfo] = Field(default_factory=list)
    # Added fields to track current user level and goal level on the frontend radar chart
    user_level: float = Field(default=0.1)
    goal_level: float = Field(default=0.1)


class TrajectoryItem(BaseModel):
    title: str
    description: str | None = None
    tags: str | None = None
    skills: SkillRequirement
    image_url: Optional[str] = Field(default=None, description="Preview image URL for the card")


# Top-level response
class TrajectoryResponse(BaseModel):
    goal: str
    items: List[TrajectoryItem]


# ------- Helpers (deduplicated) -------
def format_tasks_count(n: int) -> str:
    """Return string like '1 задание', '2 задания', '5 заданий'."""
    n_abs = abs(int(n))
    last_two = n_abs % 100
    last = n_abs % 10
    if last == 1 and last_two != 11:
        form = "задание"
    elif last in (2, 3, 4) and not (12 <= last_two <= 14):
        form = "задания"
    else:
        form = "заданий"
    return f"{int(n)} {form}"


def ensure_levels(sr: SkillRequirement) -> None:
    """Ensure levels 2/3/4 exist and sorted."""
    have = {lv.level for lv in (sr.levels or [])}
    for need in [2, 3, 4]:
        if need not in have:
            sr.levels.append(LevelInfo(level=need, level_name=None, meta=None, description=None, tasks=[]))
    sr.levels.sort(key=lambda x: x.level)


def compute_meta_for_skill(sr: SkillRequirement) -> None:
    """Compute meta per level using custom rules based on tasks counts."""
    c2 = next((len(lv.tasks) for lv in sr.levels if lv.level == 2), 0)
    c3 = next((len(lv.tasks) for lv in sr.levels if lv.level == 3), 0)
    for lv in sr.levels:
        if lv.level == 2:
            total = c2
        elif lv.level == 3:
            total = c2 + 2
        elif lv.level == 4:
            total = c2 + c3 + 1
        else:
            total = len(lv.tasks)
        lv.meta = format_tasks_count(int(total))


def map_tasks_to_levels(sr: SkillRequirement, mapping: dict[str, list[TaskInfo]]) -> None:
    """Assign tasks from mapping {"2.0"|"3.0"|"4.0": tasks[]} to levels 2/3/4 and recompute meta."""
    for lv in sr.levels:
        key = "2.0" if lv.level == 2 else ("3.0" if lv.level == 3 else ("4.0" if lv.level == 4 else None))
        if key:
            lv.tasks = mapping.get(key, [])
    compute_meta_for_skill(sr)


async def enrich_items_with_images(items: List[TrajectoryItem]) -> None:
    """Populate unique image_url for each item using external search service."""
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
                    continue
    except Exception:
        return


SYSTEM_SKILLS = "skills_system"
SYSTEM_TRAJECTORY = "trajectory_system"
SYSTEM_TASK_LIST = "task_list_system"
USER_GOAL = "Биология за 10 класс, подготовка к ЕГЭ"


@router.get("/", response_model=TrajectoryResponse)
async def get_trajectory_list(mock: bool = Query(False), chat_id: int | None = Query(None)) -> TrajectoryResponse:  # noqa: D401
    """Генерирует траекторию: сперва скилы, затем элементы траектории, объединяет ответы.

    Если ключа нет или что-то пошло не так — возвращает пустой список.
    """
    import os, json
    from app.repositories.context_store import get_context  # type: ignore

    from app.prompts.loader import load_prompt  # type: ignore

    # Static mock toggle via query (?mock=true) or env var TRAJECTORY_MOCK=1
    if mock or os.getenv("TRAJECTORY_MOCK") == "1":
        items: List[TrajectoryItem] = [
            TrajectoryItem(
                title="Кинематика: базовые законы движения",
                description="Разберёшь виды движения, графики и связи между S, V, a.",
                tags="kinematics motion velocity acceleration graphs",
                skills=SkillRequirement(name="Кинематика", recommended_level=3),
            ),
            TrajectoryItem(
                title="Динамика Ньютона и силы",
                description="Научишься применять 3 закона Ньютона и раскладывать силы.",
                tags="dynamics force newton friction normal",
                skills=SkillRequirement(name="Динамика", recommended_level=2),
            ),
            TrajectoryItem(
                title="Статика и равновесие",
                description="Условия равновесия, момент силы, центр масс.",
                tags="statics equilibrium torque lever center",
                skills=SkillRequirement(name="Статика", recommended_level=4),
            ),
            TrajectoryItem(
                title="Колебания и резонанс",
                description="Свободные и вынужденные колебания, период, частота, фазовые диаграммы.",
                tags="oscillations resonance frequency amplitude phase",
                skills=SkillRequirement(name="Теория колебаний", recommended_level=1),
            ),
            TrajectoryItem(
                title="Сопротивление материалов основы",
                description="Напряжения, деформации, диаграммы растяжения, предел текучести.",
                tags="strength materials stress strain elastic",
                skills=SkillRequirement(name="Сопротивление материалов", recommended_level=2),
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
        return TrajectoryResponse(goal=USER_GOAL, items=items)

    api_key = os.getenv("OPENAI_API_KEY")
    skills_prompt = load_prompt(SYSTEM_SKILLS)
    traj_prompt = load_prompt(SYSTEM_TRAJECTORY)
    tasks_prompt = load_prompt(SYSTEM_TASK_LIST)
    ctx = get_context(chat_id) if chat_id is not None else {}
    # if trajectory already cached for this chat, return it immediately
    if chat_id is not None and "trajectory" in ctx:
        return ctx["trajectory"]  # type: ignore [return-value]
    print("--------------------------------")
    print(ctx)
    print("--------------------------------")
    # Resolve goal and profile from context
    goal_text = (str(ctx.get("goal")).strip() if ctx.get("goal") else USER_GOAL)
    profile_block = ""
    try:
        prof = ctx.get("profile") if isinstance(ctx, dict) else None
        if isinstance(prof, dict) and any(bool(v) for v in prof.values()):
            profile_json = json.dumps(prof, ensure_ascii=False)
            profile_block = "\nПрофиль пользователя: " + profile_json
    except Exception:
        profile_block = ""

    if not api_key:
        return TrajectoryResponse(goal=goal_text, items=[])

    try:
        from openai import OpenAI  # type: ignore

        client = OpenAI(api_key=api_key)

        # 1) Сгенерировать навыки
        skills_resp = client.chat.completions.create(
            model="gpt-5-chat-latest",
            messages=[
                {"role": "system", "content": skills_prompt},
                {"role": "user", "content": "Цель пользователя: " + goal_text + profile_block},
            ],
        )
        skills_content = skills_resp.choices[0].message.content if skills_resp.choices else None
        if not skills_content:
            raise RuntimeError("empty skills completion")

        print(skills_content)

        def parse_skills(txt: str) -> list[dict]:
            try:
                data = json.loads(txt)
                raw_list: list[dict] | None = None
                if isinstance(data, dict) and isinstance(data.get("skills"), list):
                    raw_list = data["skills"]  # type: ignore[assignment]
                elif isinstance(data, list):
                    raw_list = data  # type: ignore[assignment]
                if not raw_list:
                    return []
                result: list[dict] = []
                for s in raw_list:  # type: ignore[assignment]
                    if not isinstance(s, dict):
                        continue
                    name = str(s.get("name", "")).strip()
                    if not name:
                        continue
                    rec_txt = str(s.get("recommended_level", "")).strip() or None
                    try:
                        rec_int = int(float(rec_txt)) if rec_txt else None
                    except Exception:
                        rec_int = None
                    # parse descriptions → levels
                    levels_list: list[LevelInfo] = []
                    descs = s.get("descriptions")
                    if isinstance(descs, list):
                        for d in descs:
                            if not isinstance(d, dict):
                                continue
                            lv_txt = str(d.get("level", "")).strip()
                            try:
                                lv_int = int(float(lv_txt)) if lv_txt else None
                            except Exception:
                                lv_int = None
                            levels_list.append(
                                LevelInfo(
                                    level=lv_int or 0,
                                    level_name=(str(d.get("level_name")) if d.get("level_name") else None),
                                    meta=(str(d.get("meta")) if d.get("meta") else None),
                                    description=(str(d.get("description")) if d.get("description") else None),
                                )
                            )
                    result.append(
                        {
                            "name": name,
                            "recommended_level": rec_int or 0,
                            "recommended_level_text": rec_txt,
                            "levels": levels_list,
                        }
                    )
                return result
            except Exception:
                return []
            return []

        skills_list = parse_skills(skills_content)
        skills_lines = []
        for item in skills_list:
            name = str(item.get("name", "")).strip()
            level = str(item.get("level", "")).strip()
            if name:
                skills_lines.append(f"- {name}: {level}")

        levels_help = (
			"Расшифровка уровней: 2.0 — базовый уровень освоения; 3.0 — уверенный уровень освоения; 4.0 — продвинутый уровень освоения."
		)


        # 2) Сгенерировать траекторию (названия навыков + цель + профиль)
        trajectory_user = (
			(f"Цель пользователя: {goal_text}\n" if goal_text else "") +
			"Список целевых навыков и уровней:\n" + "\n".join(skills_lines) + "\n" + levels_help
		)
        traj_resp = client.chat.completions.create(
            model="gpt-5-chat-latest",
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
                sr = SkillRequirement(name="Навык", recommended_level=1)
            else:
                lvl_raw = chosen_skill.get("recommended_level") or chosen_skill.get("level")
                try:
                    lvl_int = int(float(str(lvl_raw)))
                except Exception:
                    lvl_int = 1
                sr = SkillRequirement(
                    name=str(chosen_skill.get("name", "Навык")),
                    recommended_level=lvl_int,
                    recommended_level_text=(str(chosen_skill.get("recommended_level_text")) if chosen_skill.get("recommended_level_text") else None),
                    levels=(chosen_skill.get("levels") or []),
                )

            items.append(TrajectoryItem(title=title, description=description, tags=tags_str, skills=sr))

        # 3.5) For each item, generate tasks per level (2.0/3.0/4.0) using goal/profile context
        def parse_tasks(txt: str) -> dict[str, list[TaskInfo]]:
            import json as _json
            try:
                data = _json.loads(txt)
                if not isinstance(data, dict):
                    return {}
                result: dict[str, list[TaskInfo]] = {}
                for key in ["2.0", "3.0", "4.0"]:
                    arr = data.get(key)
                    tasks: list[TaskInfo] = []
                    if isinstance(arr, list):
                        for t in arr:
                            if isinstance(t, dict):
                                title_v = t.get("title")
                                desc_v = t.get("description")
                                if isinstance(title_v, str) and title_v.strip():
                                    tasks.append(TaskInfo(title=title_v.strip(), description=(str(desc_v) if isinstance(desc_v, str) else None)))
                    result[key] = tasks
                return result
            except Exception:
                return {}

        # ensure each skill has all three levels present
        # ensure_levels now deduped above

        for it in items:
            try:
                ensure_levels(it.skills)
                user_msg = (
                    (f"Цель пользователя: {goal_text}\n" if goal_text else "")
                    + (f"{profile_block}\n" if profile_block else "")
                    + f"Навык: {it.skills.name}\nТема: {it.title}"
                )
                tasks_resp = client.chat.completions.create(
                    model="gpt-5-chat-latest",
                    messages=[
                        {"role": "system", "content": tasks_prompt},
                        {"role": "user", "content": user_msg},
                    ],
                )
                tasks_content = tasks_resp.choices[0].message.content if tasks_resp.choices else None
                if tasks_content:
                    mapping = parse_tasks(tasks_content)
                    map_tasks_to_levels(it.skills, mapping)
                else:
                    # No tasks returned: keep meta as count 0
                    for lv in it.skills.levels:
                        lv.tasks = []
                    compute_meta_for_skill(it.skills)
            except Exception:
                # On failure, leave tasks empty but ensure meta reflects zero
                try:
                    for lv in it.skills.levels:
                        lv.tasks = []
                    compute_meta_for_skill(it.skills)
                except Exception:
                    pass

        # 4) Enrich items with images from external search
        await enrich_items_with_images(items)

        resp = TrajectoryResponse(goal=goal_text, items=items)
        if chat_id is not None:
            from app.repositories.context_store import set_trajectory  # type: ignore
            set_trajectory(chat_id, resp)
        return resp
    except Exception as e:
        print("Error generating trajectory", e)
        return TrajectoryResponse(goal=goal_text, items=[])


# Payload to update goal levels in cached trajectory
class GoalLevelsUpdate(BaseModel):
    chat_id: int
    levels: list[float]


@router.post("/goal_levels", response_model=TrajectoryResponse)
async def update_goal_levels(payload: GoalLevelsUpdate) -> TrajectoryResponse:
    """Update goal_level for each item in cached trajectory for given chat_id."""
    try:
        from app.repositories.context_store import get_context, set_trajectory  # type: ignore
    except Exception:
        # If context store is unavailable just return empty
        return TrajectoryResponse(goal="", items=[])

    ctx = get_context(payload.chat_id) if payload and isinstance(payload.chat_id, int) else {}
    existing = ctx.get("trajectory") if isinstance(ctx, dict) else None
    if not existing:
        return TrajectoryResponse(goal="", items=[])

    # Convert to model if stored as dict
    if isinstance(existing, dict):
        try:
            resp = TrajectoryResponse(**existing)
        except Exception:
            return TrajectoryResponse(goal="", items=[])
    else:
        resp = existing  # type: ignore[assignment]

    # Update goal levels
    for idx, it in enumerate(resp.items):
        val = payload.levels[idx] if idx < len(payload.levels) else 0.1
        try:
            v = float(val)
        except Exception:
            v = 0.1
        if v < 0.1:
            v = 0.1
        it.skills.goal_level = v
        
    # Save back to context
    try:
        set_trajectory(payload.chat_id, resp)
    except Exception:
        pass

    return resp


# -------- Task generation by topic --------
class GenerateTasksRequest(BaseModel):
    chat_id: int
    topic: str


class GeneratedTask(BaseModel):
    title: str
    level: int
    content_md: str
    # New fields for level 2 structured content
    questions_to_consider: list["QuestionsToConsider"] = Field(default_factory=list)
    tests: list["Tests"] = Field(default_factory=list)


class QuestionsToConsider(BaseModel):
    question: str
    answer: str | None = None


class Tests(BaseModel):
    question: str
    options: list[str] = Field(default_factory=list)
    correct: list[int] = Field(default_factory=list)
    hint: str | None = None
    explanation: str | None = None


class GenerateTasksResponse(BaseModel):
    chat_id: int
    topic: str
    goal: str
    level: int
    tasks: list[GeneratedTask] = Field(default_factory=list)


@router.post("/generate_tasks", response_model=GenerateTasksResponse)
async def generate_tasks(req: GenerateTasksRequest) -> GenerateTasksResponse:
    """Generate theory/tasks content for a trajectory item topic using goal/profile context.

    Logic:
    1) Read trajectory from context by chat_id; find item by title == topic.
    2) Determine level from skills.goal_level (rounded to 2/3/4, min 2).
    3) For each task title in skills.tasks at that level, call LLM with system prompt
       from task_generation_system and a user message that includes: goal, profile,
       skill name, topic title, level, and the task topic/title.
    4) Cache by (chat_id, topic) and return cached on subsequent calls.
    """
    from app.repositories.context_store import get_context, get_tasks, set_tasks  # type: ignore
    from app.prompts.loader import load_prompt  # type: ignore
    import os, json

    chat_id = int(req.chat_id)
    topic = str(req.topic).strip()

    ctx = get_context(chat_id)
    trajectory = ctx.get("trajectory") if isinstance(ctx, dict) else None
    if not trajectory:
        # Nothing to generate from
        return GenerateTasksResponse(chat_id=chat_id, topic=topic, goal=str(ctx.get("goal") or ""), level=2, tasks=[])

    # Normalize to model
    if isinstance(trajectory, dict):
        try:
            trajectory = TrajectoryResponse(**trajectory)
        except Exception:
            return GenerateTasksResponse(chat_id=chat_id, topic=topic, goal=str(ctx.get("goal") or ""), level=2, tasks=[])

    # Find item by title
    target = next((it for it in trajectory.items if it.title.strip() == topic), None)
    if target is None:
        return GenerateTasksResponse(chat_id=chat_id, topic=topic, goal=trajectory.goal, level=2, tasks=[])

    # Determine level from goal_level (min 2, max 4)
    gl = target.skills.goal_level if isinstance(target.skills.goal_level, (int, float)) else 2
    try:
        gl_int = int(round(float(gl)))
    except Exception:
        gl_int = 2
    if gl_int < 2:
        gl_int = 2
    if gl_int > 4:
        gl_int = 4

    # Serve from cache using topic + level key if available
    cache_key = f"{topic}::L{gl_int}"
    cached = get_tasks(chat_id, cache_key)
    if isinstance(cached, dict):
        try:
            return GenerateTasksResponse(**cached)
        except Exception:
            pass

    # Extract task titles aggregated up to selected level:
    # 2 -> only 2, 3 -> 2+3, 4 -> 2+3+4
    include_levels = {2} if gl_int == 2 else ({2, 3} if gl_int == 3 else {2, 3, 4})
    # collect: title, level, level_desc, task_desc
    task_items: list[tuple[str, int, str | None, str | None]] = []
    for lv in sorted(target.skills.levels, key=lambda x: x.level):
        if lv.level in include_levels and lv.tasks:
            for t in lv.tasks:
                if isinstance(t, dict):
                    task_title = str(t.get("title", ""))
                    task_desc = t.get("description")
                else:
                    task_title = str(getattr(t, "title", ""))
                    task_desc = getattr(t, "description", None)
                if isinstance(task_title, str) and task_title.strip():
                    lvl_desc = getattr(lv, "description", None)
                    task_items.append((task_title.strip(), lv.level, lvl_desc, task_desc))

    # Load system prompts for different levels
    def safe_prompt(name: str) -> str:
        try:
            return load_prompt(name)
        except Exception:
            return ""

    prompt_level2 = safe_prompt("task_generation_system")
    prompt_level3 = safe_prompt("practice_3_system")
    prompt_level4 = safe_prompt("practice_4_system")

    # Profile block
    profile_block = ""
    try:
        prof = ctx.get("profile") if isinstance(ctx, dict) else None
        if isinstance(prof, dict) and any(bool(v) for v in prof.values()):
            profile_json = json.dumps(prof, ensure_ascii=False)
            profile_block = "\nПрофиль пользователя: " + profile_json
    except Exception:
        profile_block = ""

    # OpenAI call
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or not task_items:
        resp = GenerateTasksResponse(chat_id=chat_id, topic=topic, goal=trajectory.goal, level=gl_int, tasks=[])
        set_tasks(chat_id, cache_key, resp.dict())
        return resp

    from openai import OpenAI  # type: ignore
    client = OpenAI(api_key=api_key)

    generated: list[GeneratedTask] = []
    for task_title, task_level, level_desc, task_desc in task_items:
        user_prompt = (
            f"Цель пользователя: {trajectory.goal}" + profile_block +
            f"\nНавык: {target.skills.name}"
            f"\nТема: {target.title}"
            f"\nОписание темы: {target.description or ''}"
            f"\nУровень задания: {task_level}.0"
            f"\nОписание уровня: {level_desc or ''}"
            f"\nНазвание задания: {task_title}"
            f"\nОписание задания: {task_desc or ''}"
        )

        print(user_prompt)
        # Choose system prompt based on level
        sys_prompt = prompt_level2
        if task_level == 3:
            sys_prompt = prompt_level3 or prompt_level2
        elif task_level == 4:
            sys_prompt = prompt_level4 or prompt_level2

        try:
            comp = client.chat.completions.create(
                model="gpt-5-chat-latest",
                messages=[
                    {"role": "system", "content": sys_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
            content = comp.choices[0].message.content if comp.choices else ""
        except Exception:
            content = ""

        # For level 2: try to parse structured JSON from updated task_generation_system
        if task_level == 2:
            import json as _json, re as _re
            payload: dict | None = None
            if isinstance(content, str):
                txt = content.strip()
                m = _re.search(r"```(?:json)?\s*([\s\S]*?)```", txt, flags=_re.IGNORECASE)
                if m:
                    txt = m.group(1).strip()
                if not txt.startswith("{"):
                    i, j = txt.find("{"), txt.rfind("}")
                    if i != -1 and j != -1 and j > i:
                        txt = txt[i:j+1]
                try:
                    if txt.startswith("{"):
                        payload = _json.loads(txt)
                except Exception:
                    payload = None

            title_out = task_title
            content_md_out = str(content or "").strip()
            q_consider: list[QuestionsToConsider] = []
            tests_out: list[Tests] = []

            if isinstance(payload, dict):
                # title/content
                tval = payload.get("title")
                if isinstance(tval, str) and tval.strip():
                    title_out = tval.strip()
                cval = payload.get("content_md") or payload.get("content")
                if isinstance(cval, str) and cval.strip():
                    content_md_out = cval.strip()

                # questions_to_consider (robust for both latin/cyrillic 'c')
                q_list = payload.get("questions_to_consider")
                if not isinstance(q_list, list):
                    q_list = payload.get("questions_to_сonsider")  # cyrillic 'с'
                if isinstance(q_list, list):
                    for q in q_list:
                        if isinstance(q, dict):
                            qs = str(q.get("question", "")).strip()
                            ans = str(q.get("answer", "")).strip() if isinstance(q.get("answer"), str) else None
                            if qs:
                                q_consider.append(QuestionsToConsider(question=qs, answer=ans))

                # tests
                t_list = payload.get("tests")
                if isinstance(t_list, list):
                    for t in t_list:
                        if not isinstance(t, dict):
                            continue
                        tq = str(t.get("question", "")).strip()
                        opts_raw = t.get("options")
                        corr_raw = t.get("correct")
                        hint = str(t.get("hint", "")).strip() if isinstance(t.get("hint"), str) else None
                        expl = str(t.get("explanation", "")).strip() if isinstance(t.get("explanation"), str) else None
                        options: list[str] = []
                        if isinstance(opts_raw, list):
                            options = [str(o) for o in opts_raw]
                        correct: list[int] = []
                        # normalize correct indexes if provided as strings
                        if isinstance(corr_raw, list):
                            for v in corr_raw:
                                try:
                                    correct.append(int(v))
                                except Exception:
                                    # try map by option value
                                    try:
                                        idx = options.index(str(v))
                                        correct.append(idx)
                                    except Exception:
                                        continue
                        if tq and options:
                            tests_out.append(Tests(question=tq, options=options, correct=correct, hint=hint, explanation=expl))

            generated.append(
                GeneratedTask(
                    title=title_out,
                    level=task_level,
                    content_md=content_md_out,
                    questions_to_consider=q_consider,
                    tests=tests_out,
                )
            )
        else:
            # 3.0/4.0 keep legacy behavior
            generated.append(GeneratedTask(title=task_title, level=task_level, content_md=str(content or "").strip()))

    resp = GenerateTasksResponse(chat_id=chat_id, topic=topic, goal=trajectory.goal, level=gl_int, tasks=generated)
    set_tasks(chat_id, cache_key, resp.dict())
    return resp
