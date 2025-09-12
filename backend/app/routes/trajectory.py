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
    passedCount: int = Field(default=0, description="Count of passed tasks for this topic from cached context")


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
    """Populate unique image_url for each item using external search service.

    The original implementation made HTTP requests *sequentially*, which slowed the
    whole /trajectory response (especially when OpenAI part had already finished).
    This version runs up-to 10 requests concurrently using asyncio.gather and a
    semaphore to avoid overloading the external service.
    """

    try:
        import httpx, asyncio

        used_urls: set[str] = set()

        async def fetch_and_choose(it: TrajectoryItem, idx: int, sem: asyncio.Semaphore) -> None:
            # One item → one external POST request guarded by semaphore
            async with sem:
                try:
                    async with httpx.AsyncClient(timeout=15.0) as client:
                        resp = await client.post(
                            "http://89.169.164.133:8000/search",
                            json={"text": it.tags, "top_k": 5},
                        )
                        resp.raise_for_status()
                        data = resp.json()

                    images: list = []
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
                    # Ignore individual failures; leave image_url empty
                    return

        # Limit concurrency to 10 to be gentle on the image service
        sem = asyncio.Semaphore(10)
        await asyncio.gather(*(fetch_and_choose(it, idx, sem) for idx, it in enumerate(items)))

    except Exception:
        # On any import / runtime error just leave images empty
        return


SYSTEM_SKILLS = "skills_system"
SYSTEM_SKILLS_ONE = "skills_system_one"
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
                tags="resistance materials stress strain yield",
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
        resp = TrajectoryResponse(goal=USER_GOAL, items=items)
        # enrich with passedCount from context tasks
        try:
            from app.repositories.context_store import get_context  # type: ignore
            ctx = get_context(int(chat_id) if chat_id is not None else -1)
            tasks_by_topic = (ctx or {}).get("tasks") or {}
            for it in resp.items:
                try:
                    # tasks cached under keys like "{title}::L{level}", so sum across all levels
                    passed_sum = 0
                    if isinstance(tasks_by_topic, dict):
                        for k, v in tasks_by_topic.items():
                            if isinstance(k, str) and it.title.strip() in k and isinstance(v, dict) and isinstance(v.get("tasks"), list):
                                for t in v.get("tasks", []):
                                    try:
                                        # exclude base-level test from passedCount
                                        try:
                                            _title = str(getattr(t, "title", "") or (t.get("title") if isinstance(t, dict) else "")).lower()
                                        except Exception:
                                            _title = ""
                                        if "тест по базовому уровню" in _title:
                                            continue
                                        if bool(getattr(t, "passed", False)) or bool((isinstance(t, dict) and t.get("passed"))):
                                            passed_sum += 1
                                    except Exception:
                                        continue
                    setattr(it, "passedCount", int(passed_sum))
                except Exception:
                    setattr(it, "passedCount", 0)
        except Exception:
            pass
        return resp

    api_key = os.getenv("OPENAI_API_KEY")
    skills_prompt = load_prompt(SYSTEM_SKILLS)
    traj_prompt = load_prompt(SYSTEM_TRAJECTORY)
    tasks_prompt = load_prompt(SYSTEM_TASK_LIST)
    ctx = get_context(chat_id) if chat_id is not None else {}
    # if trajectory already cached for this chat, enrich passedCount and return
    if chat_id is not None and "trajectory" in ctx:
        try:
            tr_raw = ctx["trajectory"]
            resp = TrajectoryResponse(**tr_raw) if isinstance(tr_raw, dict) else tr_raw
            # recompute passedCount from cached tasks
            try:
                tasks_by_topic = (ctx or {}).get("tasks") or {}
                for it in resp.items:
                    try:
                        passed_sum = 0
                        if isinstance(tasks_by_topic, dict):
                            for k, v in tasks_by_topic.items():
                                if isinstance(k, str) and it.title.strip() in k and isinstance(v, dict) and isinstance(v.get("tasks"), list):
                                    for t in v.get("tasks", []):
                                        try:
                                            try:
                                                _title = str(getattr(t, "title", "") or (t.get("title") if isinstance(t, dict) else "")).lower()
                                            except Exception:
                                                _title = ""
                                            if "тест по базовому уровню" in _title:
                                                continue
                                            if bool(getattr(t, "passed", False)) or bool((isinstance(t, dict) and t.get("passed"))):
                                                passed_sum += 1
                                        except Exception:
                                            continue
                        it.passedCount = int(passed_sum)
                    except Exception:
                        it.passedCount = 0
            except Exception:
                pass
            # save back enriched trajectory
            try:
                set_trajectory(int(chat_id), resp)
            except Exception:
                pass
            return resp
        except Exception:
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
    passed: bool = Field(default=False)


class QuestionsToConsider(BaseModel):
    question: str
    answer: str | None = None


class Tests(BaseModel):
    question: str
    options: list[str] = Field(default_factory=list)
    correct: list[int] = Field(default_factory=list)
    hint: str | None = None
    explanation: str | None = None
    answer: list[int] = Field(default_factory=list, description="User selected option indices")


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
            import asyncio
            comp = await asyncio.to_thread(
                client.chat.completions.create,
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
                # accept various casings / aliases
                cval = (
                    payload.get("content_md")
                    or payload.get("contentMd")
                    or payload.get("content")
                    or payload.get("markdown")
                )
                if isinstance(cval, str) and cval.strip():
                    content_md_out = cval.strip()

                # questions_to_consider (robust for both latin/cyrillic 'c')
                q_list = payload.get("questions_to_consider")
                if not isinstance(q_list, list):
                    q_list = payload.get("questions_to_сonsider")  # cyrillic 'с'
                if not isinstance(q_list, list):
                    q_list = payload.get("questionsToConsider")
                if not isinstance(q_list, list):
                    # sometimes nested under items
                    items = payload.get("items")
                    if isinstance(items, dict):
                        q_list = items.get("questions_to_consider") or items.get("questionsToConsider")
                if isinstance(q_list, list):
                    for q in q_list:
                        if isinstance(q, dict):
                            qs = str(q.get("question", "")).strip()
                            ans = str(q.get("answer", "")).strip() if isinstance(q.get("answer"), str) else None
                            if qs:
                                q_consider.append(QuestionsToConsider(question=qs, answer=ans))

                # tests
                t_list = payload.get("tests")
                if not isinstance(t_list, list):
                    t_list = payload.get("test")
                if not isinstance(t_list, list):
                    items = payload.get("items")
                    if isinstance(items, dict):
                        arr = items.get("tests") or items.get("test")
                        if isinstance(arr, list):
                            t_list = arr
                if isinstance(t_list, list):
                    for t in t_list:
                        if not isinstance(t, dict):
                            continue
                        tq = str(t.get("question", "")).strip()
                        opts_raw = t.get("options") or t.get("variants") or t.get("choices")
                        corr_raw = t.get("correct") or t.get("answers") or t.get("answer")
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
                        elif isinstance(corr_raw, (int, float, str)):
                            # single answer
                            try:
                                correct.append(int(corr_raw))
                            except Exception:
                                try:
                                    idx = options.index(str(corr_raw))
                                    correct.append(idx)
                                except Exception:
                                    pass
                        if tq and options:
                            tests_out.append(Tests(question=tq, options=options, correct=correct, hint=hint, explanation=expl))

            generated.append(
                GeneratedTask(
                    title=title_out,
                    level=task_level,
                    content_md=content_md_out,
                    questions_to_consider=q_consider,
                    tests=tests_out,
                    passed=False,
                )
            )
        else:
            # 3.0/4.0 keep legacy behavior
            generated.append(GeneratedTask(title=task_title, level=task_level, content_md=str(content or "").strip(), passed=False))

    # After generating all tasks, append a synthetic Level 2 test built from 5 random Level 2 tests
    try:
        import random as _random
        # collect all tests from already generated level-2 tasks
        level2_tests: list[Tests] = []
        for t in generated:
            try:
                if int(getattr(t, "level", 0)) == 2 and isinstance(t.tests, list) and t.tests:
                    for q in t.tests:
                        if isinstance(q, Tests):
                            level2_tests.append(q)
                        elif isinstance(q, dict):
                            # tolerate dict shape
                            tq = str(q.get("question", "")).strip()
                            opts = q.get("options") or []
                            corr = q.get("correct") or []
                            hint = q.get("hint") if isinstance(q.get("hint"), str) else None
                            expl = q.get("explanation") if isinstance(q.get("explanation"), str) else None
                            if tq and isinstance(opts, list):
                                level2_tests.append(Tests(question=tq, options=[str(o) for o in opts], correct=[int(x) for x in corr if isinstance(x, (int, float, str)) and str(x).strip().isdigit()], hint=hint, explanation=expl))
            except Exception:
                continue
        # choose up to 5 random unique tests
        if level2_tests:
            try:
                selected = _random.sample(level2_tests, k=min(5, len(level2_tests)))
            except Exception:
                selected = level2_tests[:5]
            if selected:
                test_task = GeneratedTask(
                    title="Тест по базовому уровню",
                    level=2,
                    content_md="### Тест по теме \n\nОтветь на вопросы и проверь, освоена ли тема на базовый уровень",
                    questions_to_consider=[],
                    tests=selected,
                    passed=False,
                )
                # find the first index where level >= 3 to insert before it
                insert_idx = None
                for idx, t in enumerate(generated):
                    try:
                        if int(getattr(t, "level", 0)) >= 3:
                            insert_idx = idx
                            break
                    except Exception:
                        continue
                if insert_idx is None:
                    generated.append(test_task)
                else:
                    try:
                        generated.insert(insert_idx, test_task)
                    except Exception:
                        generated.append(test_task)
    except Exception:
        pass

    # sanitize content_md: remove lines like \n\n---\n\n (and with surrounding whitespace)
    import re as _re
    for t in generated:
        try:
            if isinstance(t.content_md, str):
                t.content_md = _re.sub(r"\n\s*---\s*\n", "\n", t.content_md)
        except Exception:
            pass

    resp = GenerateTasksResponse(chat_id=chat_id, topic=topic, goal=trajectory.goal, level=gl_int, tasks=generated)
    set_tasks(chat_id, cache_key, resp.dict())
    return resp


class UpdateTaskPassedRequest(BaseModel):
    chat_id: int
    topic: str
    index: int = Field(description="Zero-based task index in tasks array (task)")
    passed: bool
    answer: list[TaskAnswer] | None = Field(default=None, description="Array of selected option indices for given test")

class TaskAnswer(BaseModel):
    index: int
    answer: list[int]

@router.post("/tasks/passed")
async def update_task_passed(req: UpdateTaskPassedRequest) -> GenerateTasksResponse:
    """Update 'passed' flag for a task in cached tasks for given chat/topic.

    Reads tasks from context store (same cache as generate_tasks), updates flag, saves back and returns updated payload.
    """
    from app.repositories.context_store import get_tasks, set_tasks  # type: ignore

    chat_id = int(req.chat_id)
    topic = str(req.topic).strip()
    cache_key = f"{topic}::L2"  # default fallback; below we try all levels if not found
    cached = None
    # try exact level keys first
    for key in [f"{topic}::L2", f"{topic}::L3", f"{topic}::L4", topic]:
        cached = get_tasks(chat_id, key)
        if cached:
            cache_key = key
            break
    if not isinstance(cached, dict):
        # nothing cached yet
        return GenerateTasksResponse(chat_id=chat_id, topic=topic, goal="", level=2, tasks=[])

    try:
        resp = GenerateTasksResponse(**cached)
    except Exception:
        return GenerateTasksResponse(chat_id=chat_id, topic=topic, goal="", level=2, tasks=[])

    idx = max(0, min(req.index, len(resp.tasks) - 1)) if resp.tasks else 0
    if resp.tasks:
        try:
            # 1) Обновляем флаг passed для задачи по индексу idx
            resp.tasks[idx].passed = bool(req.passed)

            # 2) Если пришёл массив ответов (пары {index, answer}), записываем каждый в соответствующий вопрос
            if req.answer is not None and isinstance(req.answer, list):
                target_task = resp.tasks[idx]
                if isinstance(getattr(target_task, "tests", None), list):
                    for entry in req.answer:
                        try:
                            q_idx = int(getattr(entry, "index", -1))
                            ans = getattr(entry, "answer", [])
                            if 0 <= q_idx < len(target_task.tests):
                                target_task.tests[q_idx].answer = [int(x) for x in (ans or [])]
                        except Exception:
                            continue
        except Exception:
            pass

    # save back
    try:
        set_tasks(chat_id, cache_key, resp.dict())
    except Exception:
        pass

    # --- Progression rules → update user_level in trajectory stored in context ---
    try:
        from app.repositories.context_store import get_context, set_trajectory  # type: ignore
        ctx = get_context(chat_id)
        tr = ctx.get("trajectory") if isinstance(ctx, dict) else None
        # normalize trajectory model
        if isinstance(tr, dict):
            try:
                tr = TrajectoryResponse(**tr)
            except Exception:
                tr = None
        if tr is not None and isinstance(tr, TrajectoryResponse):
            # gather all cached tasks for this topic across possible keys
            from app.repositories.context_store import get_tasks as _get_tasks  # type: ignore
            all_tasks: list[GeneratedTask] = []
            for k in [f"{req.topic}::L2", f"{req.topic}::L3", f"{req.topic}::L4", f"{req.topic}"]:
                cached_any = _get_tasks(chat_id, k)
                if isinstance(cached_any, dict):
                    try:
                        gtr = GenerateTasksResponse(**cached_any)
                        if isinstance(gtr.tasks, list):
                            for t in gtr.tasks:
                                # ensure each has level
                                try:
                                    lvl = int(getattr(t, "level", 0))
                                except Exception:
                                    lvl = 0
                                if lvl in (2, 3, 4):
                                    all_tasks.append(t)
                    except Exception:
                        pass

            # compute progression
            any_passed = any(bool(getattr(t, "passed", False)) for t in all_tasks)
            def _is_base_test(t) -> bool:
                try:
                    return (
                        int(getattr(t, "level", 0)) == 2
                        and isinstance(getattr(t, "title", None), str)
                        and "тест по базовому уровню" in str(getattr(t, "title")).lower()
                    )
                except Exception:
                    return False

            def level_passed(L: int) -> tuple[int, int]:
                # Exclude base-level summary test from L2 counts
                sel = [
                    t
                    for t in all_tasks
                    if int(getattr(t, "level", 0)) == L and not (_is_base_test(t) if L == 2 else False)
                ]
                total = len(sel)
                done = sum(1 for t in sel if bool(getattr(t, "passed", False)))
                return done, total

            l2_done, l2_total = level_passed(2)
            l3_done, l3_total = level_passed(3)
            l4_done, l4_total = level_passed(4)

            # пройден ли тест по базовому уровню (уровень 2, название содержит), passed=true
            l2_test_passed = any(
                int(getattr(t, "level", 0)) == 2
                and isinstance(getattr(t, "title", None), str)
                and "тест по базовому уровню" in str(getattr(t, "title")).lower()
                and bool(getattr(t, "passed", False))
                for t in all_tasks
            )

            # удобные флаги завершения уровней (если заданий нет — считаем уровень завершён)
            l2_completed = ((l2_total > 0) and (l2_done == l2_total)) or l2_test_passed
            l3_completed = (l3_total > 0) and (l3_done == l3_total)
            l4_completed = (l4_total > 0) and (l4_done == l4_total)

            new_user_level: float = 0.1
            if any_passed:
                new_user_level = 1
            if l2_completed:
                new_user_level = max(new_user_level, 2)
            if l2_completed and l3_completed:
                new_user_level = max(new_user_level, 3)
            if l2_completed and l3_completed and l4_completed:
                new_user_level = max(new_user_level, 4)

            # update in trajectory for matching topic
            try:
                for it in tr.items:
                    if str(it.title).strip() == str(req.topic).strip():
                        try:
                            it.skills.user_level = float(new_user_level)
                        except Exception:
                            pass
                        break
            except Exception:
                pass

            try:
                set_trajectory(chat_id, tr)
            except Exception:
                pass
    except Exception:
        pass

    return resp


class MetaExpandRequest(BaseModel):
    chat_id: int


class MetaExpandItem(BaseModel):
    title: str
    expansions: list[str] = Field(default_factory=list)


class MetaExpandResponse(BaseModel):
    chat_id: int
    items: list[MetaExpandItem] = Field(default_factory=list)


@router.post("/meta_expand", response_model=MetaExpandResponse)
async def meta_expand(req: MetaExpandRequest) -> MetaExpandResponse:
    """Generate expanded meta description based on trajectory items' titles.

    - Reads trajectory from context by chat_id
    - Builds a comma-separated list of item titles
    - Calls LLM with system prompt from meta_expand_system.txt and the user prompt as that list
    - Caches result in context (ctx["meta_expand"]) and returns cached value if present
    """
    from app.repositories.context_store import get_context  # type: ignore
    from app.prompts.loader import load_prompt  # type: ignore
    import os

    chat_id = int(req.chat_id)
    ctx = get_context(chat_id)
    cached = None
    if isinstance(ctx, dict):
        cached = ctx.get("meta_expand")
        if isinstance(cached, dict) and int(cached.get("chat_id", 0)) == chat_id and isinstance(cached.get("items"), list):
            try:
                items_cached = [MetaExpandItem(**it) if isinstance(it, dict) else None for it in cached.get("items", [])]
                items_cached = [it for it in items_cached if it is not None]
                return MetaExpandResponse(chat_id=chat_id, items=items_cached)  # type: ignore[arg-type]
            except Exception:
                pass

    trajectory = ctx.get("trajectory") if isinstance(ctx, dict) else None
    titles: list[str] = []
    try:
        if trajectory and isinstance(trajectory, dict):
            items = trajectory.get("items") or []
            for it in items:
                try:
                    title = str(it.get("title", "")).strip()
                    if title:
                        titles.append(title)
                except Exception:
                    continue
        elif trajectory and hasattr(trajectory, "items"):
            for it in getattr(trajectory, "items", []):
                try:
                    title = str(getattr(it, "title", "")).strip()
                    if title:
                        titles.append(title)
                except Exception:
                    continue
    except Exception:
        titles = []

    # provide titles as JSON array to encourage structured response
    try:
        import json as _json
        user_prompt = _json.dumps({"titles": titles}, ensure_ascii=False)
    except Exception:
        user_prompt = ", ".join(titles)

    system_prompt = load_prompt("meta_expand_system")

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return MetaExpandResponse(chat_id=chat_id, items=[])

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

    # try to parse into structured items [{title, expansions[]}]
    items_out: list[MetaExpandItem] = []
    try:
        import json as _json, re as _re
        txt = str(content or "").strip()
        # strip fenced code if present
        m = _re.search(r"```(?:json)?\s*([\s\S]*?)```", txt, flags=_re.IGNORECASE)
        if m:
            txt = m.group(1).strip()
        # find JSON array or object with items
        if txt.startswith("{") or txt.startswith("["):
            data = _json.loads(txt)
            arr = None
            if isinstance(data, dict):
                # format A: { items: [{ title, expansions: [] }, ...] }
                if isinstance(data.get("items"), list):
                    arr = data["items"]
                # format B: { expansions: { "Title": [..], ... } }
                elif isinstance(data.get("expansions"), dict):
                    exp_map = data.get("expansions")
                    for k, v in (exp_map or {}).items():
                        title = str(k).strip()
                        if not title:
                            continue
                        exps = v if isinstance(v, list) else []
                        exps = [str(x).strip() for x in exps if str(x).strip()]
                        items_out.append(MetaExpandItem(title=title, expansions=exps))
                # format C: direct dict { "Title": [..] }
                else:
                    simple_map = data
                    ok = True
                    for k, v in simple_map.items():
                        if not isinstance(v, list):
                            ok = False
                            break
                    if ok:
                        for k, v in simple_map.items():
                            title = str(k).strip()
                            exps = [str(x).strip() for x in v if str(x).strip()]
                            if title:
                                items_out.append(MetaExpandItem(title=title, expansions=exps))
            elif isinstance(data, list):
                arr = data
            if isinstance(arr, list):
                for it in arr:
                    if isinstance(it, dict):
                        title = str(it.get("title", "")).strip()
                        exps = it.get("expansions")
                        if isinstance(exps, list):
                            exps = [str(x).strip() for x in exps if str(x).strip()]
                        else:
                            exps = []
                        if title:
                            items_out.append(MetaExpandItem(title=title, expansions=exps))
        # fallback: map each input title to empty expansions
        if not items_out and titles:
            items_out = [MetaExpandItem(title=t, expansions=[]) for t in titles]
    except Exception:
        items_out = [MetaExpandItem(title=t, expansions=[] ) for t in titles]

    # save to context
    try:
        from app.repositories.context_store import get_context as _get_ctx  # type: ignore
        c = _get_ctx(chat_id)
        if isinstance(c, dict):
            c["meta_expand"] = {"chat_id": chat_id, "items": [it.dict() for it in items_out]}
    except Exception:
        pass

    return MetaExpandResponse(chat_id=chat_id, items=items_out)


# --------- Extended meta expand by single topic ---------
class MetaExtendRequest(BaseModel):
    chat_id: int
    topic: str


@router.post("/meta_extend_new", response_model=MetaExpandResponse)
async def meta_extend(req: MetaExtendRequest) -> MetaExpandResponse:
    """Extend meta expansions for a specific topic using a stricter prompt.

    Logic:
    1) Read trajectory and existing meta_expand from context by chat_id
    2) Build disallowed topics list from trajectory (all titles except the requested topic)
    3) Call LLM with system prompt 'meta_extended_system' (fallback to 'meta_expand_system') and pass
       JSON payload: { topic, disallowed, existing }
    4) Merge LLM result with existing context data, deduplicate, and return updated items
    5) Save updated meta_expand back to context
    """
    from app.repositories.context_store import get_context  # type: ignore
    from app.prompts.loader import load_prompt  # type: ignore
    import os
    import json as _json

    chat_id = int(req.chat_id)
    topic = str(req.topic).strip()

    # 1) Context
    ctx = get_context(chat_id)
    trajectory = ctx.get("trajectory") if isinstance(ctx, dict) else None
    # Normalize titles list and disallowed
    titles: list[str] = []
    try:
        if trajectory and isinstance(trajectory, dict):
            items = trajectory.get("items") or []
            for it in items:
                try:
                    t = str(it.get("title", "")).strip()
                    if t:
                        titles.append(t)
                except Exception:
                    continue
        elif trajectory and hasattr(trajectory, "items"):
            for it in getattr(trajectory, "items", []):
                try:
                    t = str(getattr(it, "title", "")).strip()
                    if t:
                        titles.append(t)
                except Exception:
                    continue
    except Exception:
        titles = []

    disallowed = [t for t in titles if t != topic]

    # 2) Existing meta_expand from context
    existing_map: dict[str, list[str]] = {}
    try:
        mx = ctx.get("meta_expand") if isinstance(ctx, dict) else None
        if isinstance(mx, dict) and isinstance(mx.get("items"), list):
            for it in mx.get("items", []):
                try:
                    if isinstance(it, dict):
                        k = str(it.get("title", "")).strip()
                        arr = it.get("expansions") or []
                        if k:
                            existing_map[k] = [str(x).strip() for x in arr if str(x).strip()]
                except Exception:
                    continue
    except Exception:
        existing_map = {}

    # payload for LLM
    try:
        user_payload = {
            "topic": topic,
            "disallowed": disallowed,
            "existing": existing_map.get(topic, []),
        }
        user_prompt = _json.dumps(user_payload, ensure_ascii=False)
    except Exception:
        user_prompt = f"topic={topic}; disallowed={', '.join(disallowed)}; existing={', '.join(existing_map.get(topic, []))}"

    # 3) System prompt
    try:
        system_prompt = load_prompt("meta_extended_system")
    except Exception:
        system_prompt = load_prompt("meta_expand_system")

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        # Return existing data if no key
        # Prepare items list from existing map
        items_out = [MetaExpandItem(title=k, expansions=v) for k, v in existing_map.items()]
        # Ensure the requested topic exists in list
        if topic and topic not in existing_map:
            items_out.append(MetaExpandItem(title=topic, expansions=[]))
        return MetaExpandResponse(chat_id=chat_id, items=items_out)

    # 4) Call LLM
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
        print(content)
    except Exception:
        content = ""

    # Parse LLM response into a mapping { title -> [expansions] }
    new_map: dict[str, list[str]] = {}
    try:
        import json as _json, re as _re
        txt = str(content or "").strip()
        m = _re.search(r"```(?:json)?\s*([\s\S]*?)```", txt, flags=_re.IGNORECASE)
        if m:
            txt = m.group(1).strip()
        data = None
        if txt.startswith("[") or txt.startswith("{"):
            try:
                data = _json.loads(txt)
            except Exception:
                data = None
        if isinstance(data, list):
            if all(isinstance(x, str) for x in data):
                new_map[topic] = [str(x).strip() for x in data if str(x).strip()]
            else:
                for it in data:
                    if isinstance(it, dict):
                        t = str(it.get("title", "") or it.get("topic", "")).strip() or topic
                        arr = it.get("expansions") or it.get("items") or []
                        if isinstance(arr, list):
                            new_map[t] = [str(x).strip() for x in arr if str(x).strip()]
        elif isinstance(data, dict):
            if isinstance(data.get("expansions"), list):
                new_map[topic] = [str(x).strip() for x in data.get("expansions", []) if str(x).strip()]
            elif isinstance(data.get("expansions"), dict):
                # format: { expansions: { "Title": [..], ... } }
                exp_map = data.get("expansions") or {}
                for k, v in exp_map.items():
                    try:
                        t = str(k).strip() or topic
                        if isinstance(v, list):
                            new_map[t] = [str(x).strip() for x in v if str(x).strip()]
                        elif isinstance(v, str):
                            # comma/newline separated string
                            vals = [s.strip() for s in v.replace("\n", ",").split(",") if s.strip()]
                            new_map[t] = vals
                    except Exception:
                        continue
            elif isinstance(data.get("items"), list):
                for it in data.get("items", []):
                    if isinstance(it, dict):
                        t = str(it.get("title", "") or it.get("topic", "")).strip() or topic
                        arr = it.get("expansions") or []
                        if isinstance(arr, list):
                            new_map[t] = [str(x).strip() for x in arr if str(x).strip()]
            else:
                # direct dict: {"Title": [..], ...} or single {title, expansions}
                if any(isinstance(v, list) for v in data.values()):
                    for k, v in data.items():
                        if isinstance(v, list):
                            t = str(k).strip() or topic
                            new_map[t] = [str(x).strip() for x in v if str(x).strip()]
                else:
                    t = str(data.get("title", "") or data.get("topic", "")).strip() or topic
                    arr = data.get("expansions") or []
                    if isinstance(arr, list):
                        new_map[t] = [str(x).strip() for x in arr if str(x).strip()]
        else:
            buff: list[str] = []
            for line in txt.splitlines():
                s = line.strip().lstrip("-•*").strip()
                if s:
                    buff.append(s)
            if buff:
                new_map[topic] = buff
    except Exception:
        new_map = {}

    # 5) Merge per title with existing, filter disallowed and duplicates
    def _norm(s: str) -> str:
        return " ".join(str(s).split()).strip().lower()

    disallowed_norm = {_norm(t) for t in disallowed}
    def merge_lists(title_key: str, old: list[str], new: list[str]) -> list[str]:
        merged: list[str] = []
        seen: set[str] = set()
        for x in (old or []):
            nx = _norm(x)
            if nx and nx not in disallowed_norm and nx not in seen and nx != _norm(title_key):
                seen.add(nx)
                merged.append(x)
        for x in (new or []):
            nx = _norm(x)
            if nx and nx not in disallowed_norm and nx not in seen and nx != _norm(title_key):
                seen.add(nx)
                merged.append(x)
        return merged

    # 6) Save back to context under meta_expand
    try:
        if isinstance(ctx, dict):
            items_ctx: list[dict] = []
            try:
                mx = ctx.get("meta_expand") or {}
                arr = mx.get("items") if isinstance(mx, dict) else []
                if isinstance(arr, list):
                    items_ctx = [it for it in arr if isinstance(it, dict)]
            except Exception:
                items_ctx = []
            # convert current list to map for merging
            ctx_map: dict[str, list[str]] = {}
            for it in items_ctx:
                try:
                    ctx_map[str(it.get("title", "")).strip()] = list(it.get("expansions") or [])
                except Exception:
                    continue
            # union keys and rebuild list (ensure requested topic key exists)
            all_titles = set(ctx_map.keys()) | (set(new_map.keys()) if new_map else set())
            if topic:
                all_titles.add(topic)
            if not all_titles:
                all_titles = {topic}
            items_ctx = []
            for t in all_titles:
                old_list = ctx_map.get(t, [])
                new_list = new_map.get(t, [])
                items_ctx.append({"title": t, "expansions": merge_lists(t, old_list, new_list)})
            ctx["meta_expand"] = {"chat_id": chat_id, "items": items_ctx}
    except Exception:
        pass

    # 7) Build response from context state
    try:
        items_out = [MetaExpandItem(title=str(it.get("title")), expansions=list(it.get("expansions") or [])) for it in ctx.get("meta_expand", {}).get("items", [])]
    except Exception:
        # fall back to new_map or empty
        if new_map:
            items_out = [MetaExpandItem(title=k, expansions=v) for k, v in new_map.items()]
        else:
            items_out = [MetaExpandItem(title=topic, expansions=existing_map.get(topic, []))]
    return MetaExpandResponse(chat_id=chat_id, items=items_out)
    

# -------- Single-item trajectory by topic --------
class TopicTrajectoryRequest(BaseModel):
    chat_id: int
    topic: str


@router.post("/by_topic", response_model=TrajectoryResponse)
async def generate_trajectory_by_topic(req: TopicTrajectoryRequest) -> TrajectoryResponse:
    """Generate single-item trajectory seeded by a requested skill/topic.

    Mirrors get_trajectory_list logic, but:
    - Uses SYSTEM_SKILLS_ONE and injects the requested topic into the skills prompt
    - Caches by (chat_id, topic) using get_topic_trajectory/set_topic_trajectory
    - Returns only the first generated item
    """
    from app.repositories.context_store import (
        get_context,
        get_topic_trajectory,
        set_topic_trajectory,
    )  # type: ignore
    from app.prompts.loader import load_prompt  # type: ignore
    import os, json

    chat_id = int(req.chat_id)
    topic = str(req.topic).strip()

    # Cache check
    cached = get_topic_trajectory(chat_id, topic)
    if isinstance(cached, dict):
        try:
            return TrajectoryResponse(**cached)
        except Exception:
            pass
    elif cached is not None:
        try:
            return cached  # type: ignore[return-value]
        except Exception:
            pass

    ctx = get_context(chat_id)
    goal_text = (str(ctx.get("goal")).strip() if isinstance(ctx, dict) and ctx.get("goal") else USER_GOAL)
    profile_block = ""
    try:
        prof = ctx.get("profile") if isinstance(ctx, dict) else None
        if isinstance(prof, dict) and any(bool(v) for v in prof.values()):
            profile_json = json.dumps(prof, ensure_ascii=False)
            profile_block = "\nПрофиль пользователя: " + profile_json
    except Exception:
        profile_block = ""

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return TrajectoryResponse(goal=goal_text, items=[])

    try:
        from openai import OpenAI  # type: ignore

        client = OpenAI(api_key=api_key)

        # 1) Skills
        skills_prompt = load_prompt("skills_system_one")
        traj_prompt = load_prompt(SYSTEM_TRAJECTORY)
        tasks_prompt = load_prompt(SYSTEM_TASK_LIST)
        skills_resp = client.chat.completions.create(
            model="gpt-5-chat-latest",
            messages=[
                {"role": "system", "content": skills_prompt},
                {"role": "user", "content": "Цель пользователя: " + goal_text + profile_block + f"\nНавык: {topic}"},
            ],
        )
        skills_content = skills_resp.choices[0].message.content if skills_resp.choices else None
        if not skills_content:
            return TrajectoryResponse(goal=goal_text, items=[])

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
                    # levels
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

        # 2) Trajectory
        trajectory_user = (
            (f"Цель пользователя: {goal_text}\n" if goal_text else "")
            + "Список целевых навыков и уровней:\n" + "\n".join(skills_lines) + "\n" + levels_help
        )
        traj_resp = client.chat.completions.create(
            model="gpt-5-chat-latest",
            messages=[
                {"role": "system", "content": traj_prompt},
                {"role": "user", "content": trajectory_user},
            ],
        )
        traj_content = traj_resp.choices[0].message.content if traj_resp.choices else None
        if not traj_content:
            return TrajectoryResponse(goal=goal_text, items=[])

        def parse_traj(txt: str) -> list[dict]:
            try:
                data = json.loads(txt)
                if isinstance(data, list):
                    return data
                if isinstance(data, dict):
                    if "items" in data and isinstance(data["items"], list):
                        return data["items"]
                    if "modules" in data and isinstance(data["modules"], list):
                        return data["modules"]
            except Exception:
                return []
            return []

        traj_items_raw = parse_traj(traj_content)

        # 3) Build items and map skills (keep only first)
        items: list[TrajectoryItem] = []
        for it in traj_items_raw:
            title = str(it.get("title", "")).strip()
            if not title:
                continue
            description = str(it.get("description", "")).strip() or None
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

            chosen_skill = skills_list[0] if skills_list else None
            if chosen_skill is None:
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

        if not items:
            return TrajectoryResponse(goal=goal_text, items=[])
        items = [items[0]]

        # 4) Tasks per levels for the single item
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

        it = items[0]
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
                for lv in it.skills.levels:
                    lv.tasks = []
                compute_meta_for_skill(it.skills)
        except Exception:
            try:
                for lv in it.skills.levels:
                    lv.tasks = []
                compute_meta_for_skill(it.skills)
            except Exception:
                pass

        # 5) Image
        await enrich_items_with_images(items)

        # 6) passedCount
        try:
            tasks_by_topic = (ctx or {}).get("tasks") or {}
            try:
                passed_sum = 0
                if isinstance(tasks_by_topic, dict):
                    for k, v in tasks_by_topic.items():
                        if isinstance(k, str) and it.title.strip() in k and isinstance(v, dict) and isinstance(v.get("tasks"), list):
                            for t in v.get("tasks", []):
                                try:
                                    try:
                                        _title = str(getattr(t, "title", "") or (t.get("title") if isinstance(t, dict) else "")).lower()
                                    except Exception:
                                        _title = ""
                                    if "тест по базовому уровню" in _title:
                                        continue
                                    if bool(getattr(t, "passed", False)) or bool((isinstance(t, dict) and t.get("passed"))):
                                        passed_sum += 1
                                except Exception:
                                    continue
                setattr(it, "passedCount", int(passed_sum))
            except Exception:
                setattr(it, "passedCount", 0)
        except Exception:
            pass

        resp = TrajectoryResponse(goal=goal_text, items=items)
        try:
            set_topic_trajectory(chat_id, topic, resp)
        except Exception:
            pass
        return resp
    except Exception:
        return TrajectoryResponse(goal=goal_text, items=[])
    