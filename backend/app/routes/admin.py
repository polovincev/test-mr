from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.prompt import Prompt
from app.models.user import User
from app.models.chat import Chat, ChatMessage
from app.models.context_kv import ChatContextKV
from sqlalchemy import func

from app.repositories.context_store import clear_all
from app.routes.chat import get_chat_repo

router = APIRouter(prefix="/admin", tags=["admin"])


# noinspection PyAsyncCall
@router.post("/clear")
async def admin_clear():
    """Clear all in-memory context and chats (dangerous)."""
    try:
        repo = await get_chat_repo()  # type: ignore[arg-type]
        clear_fn = getattr(repo, "clear_all", None)
        if callable(clear_fn):
            clear_fn()
    except Exception:
        pass
    clear_all()
    return {"status": "ok"}


@router.get("/prompts")
def list_prompts(db: Session = Depends(get_db)):
    rows = db.query(Prompt).all()
    return [
        {"id": r.id, "name": r.name, "current_text": r.current_text, "default_text": r.default_text}
        for r in rows
    ]


@router.get("/prompts/{name}")
def get_prompt(name: str, db: Session = Depends(get_db)):
    row = db.query(Prompt).filter_by(name=name).first()
    if not row:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return {"id": row.id, "name": row.name, "current_text": row.current_text, "default_text": row.default_text}


@router.put("/prompts/{name}")
def update_prompt(name: str, payload: dict, db: Session = Depends(get_db)):
    row = db.query(Prompt).filter_by(name=name).first()
    if not row:
        raise HTTPException(status_code=404, detail="Prompt not found")
    text = payload.get("current_text")
    if not isinstance(text, str) or not text.strip():
        raise HTTPException(status_code=400, detail="current_text must be non-empty string")
    row.current_text = text
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"status": "ok"}


@router.get("/stats")
def admin_stats(db: Session = Depends(get_db)):
    users = db.query(func.count(User.id)).scalar() or 0
    chats = db.query(func.count(Chat.id)).scalar() or 0
    messages = db.query(func.count(ChatMessage.id)).scalar() or 0
    # messages by role
    by_role = dict(
        (r or "unknown", c)
        for r, c in db.query(ChatMessage.role, func.count(ChatMessage.id)).group_by(ChatMessage.role).all()
    )
    # chats by mode
    by_mode = dict(
        (m or "unknown", c)
        for m, c in db.query(Chat.mode, func.count(Chat.id)).group_by(Chat.mode).all()
    )
    # top active chats (last 7 days)
    # simple count per chat
    top_chats = [
        {"chat_id": cid, "messages": cnt}
        for cid, cnt in db.query(ChatMessage.chat_id, func.count(ChatMessage.id))
        .group_by(ChatMessage.chat_id)
        .order_by(func.count(ChatMessage.id).desc())
        .limit(10)
        .all()
    ]

    # recent 20 goals from trajectory payloads
    recent_goals: list[dict] = []
    traj_rows = (
        db.query(ChatContextKV)
        .filter(ChatContextKV.key == "trajectory")
        .order_by(ChatContextKV.id.desc())
        .limit(50)
        .all()
    )
    for row in traj_rows:
        try:
            import json
            payload = json.loads(row.value)
            if isinstance(payload, dict):
                goal_text = payload.get("goal")
                if isinstance(goal_text, str) and goal_text.strip():
                    recent_goals.append({"chat_id": row.chat_id, "goal": goal_text.strip()})
            if len(recent_goals) >= 20:
                break
        except Exception:
            continue

    # trajectories composed
    trajectories_count = db.query(func.count(ChatContextKV.id)).filter(ChatContextKV.key == "trajectory").scalar() or 0
    topic_trajectories_count = db.query(func.count(ChatContextKV.id)).filter(ChatContextKV.key.like("topic_traj:%")).scalar() or 0

    # tasks completion stats
    task_rows = db.query(ChatContextKV.value).filter(ChatContextKV.key.like("tasks:%")).all()
    tasks_total = 0
    tasks_completed = 0
    for (val,) in task_rows:
        try:
            import json
            items = json.loads(val)
            if isinstance(items, list):
                tasks_total += len(items)
                for it in items:
                    if isinstance(it, dict) and it.get("passed"):
                        tasks_completed += 1
        except Exception:
            continue
    avg_completion = (tasks_completed / tasks_total) if tasks_total else 0.0
    return {
        "users": users,
        "chats": chats,
        "messages": messages,
        "messages_by_role": by_role,
        "chats_by_mode": by_mode,
        "top_chats": top_chats,
        "recent_goals": recent_goals,
        "trajectories_count": trajectories_count,
        "topic_trajectories_count": topic_trajectories_count,
        "tasks_total": tasks_total,
        "tasks_completed": tasks_completed,
        "avg_completion": avg_completion,
    }
