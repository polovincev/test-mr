"""Key-value context storage per chat using SQLite (ChatContextKV table)."""
from __future__ import annotations

import json
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models.context_kv import ChatContextKV

# --- helpers ---------------------------------------------------------------


def _to_json(obj: Any) -> str:
    """Serialize to JSON, handling pydantic models."""
    try:
        if hasattr(obj, "model_dump"):
            obj = obj.model_dump()
        elif hasattr(obj, "dict"):
            obj = obj.dict()
    except Exception:
        pass
    return json.dumps(obj, ensure_ascii=False)


def _get_value(chat_id: int, key: str) -> Optional[str]:
    with SessionLocal() as db:  # type: Session
        row = db.execute(
            select(ChatContextKV.value).where(ChatContextKV.chat_id == chat_id, ChatContextKV.key == key)
        ).scalar_one_or_none()
        return row  # type: ignore[return-value]


def _set_value(chat_id: int, key: str, value_str: str) -> None:
    with SessionLocal() as db:  # type: Session
        row = db.execute(
            select(ChatContextKV).where(ChatContextKV.chat_id == chat_id, ChatContextKV.key == key)
        ).scalar_one_or_none()
        if row:
            row.value = value_str
        else:
            row = ChatContextKV(chat_id=chat_id, key=key, value=value_str)
            db.add(row)
        db.commit()

# --- trajectory -----------------------------------------------------------

def get_trajectory(chat_id: int):
    val = _get_value(chat_id, "trajectory")
    if val is None:
        return None
    try:
        return json.loads(val)
    except Exception:
        return val


def set_trajectory(chat_id: int, trajectory):
    _set_value(chat_id, "trajectory", _to_json(trajectory))

# ------- goal & profile ----------------------------------------------------


def upsert_goal(chat_id: int, goal_text: str) -> None:
    _set_value(chat_id, "goal", goal_text.strip())


def upsert_profile(chat_id: int, profile: dict) -> None:
    _set_value(chat_id, "profile", json.dumps(profile, ensure_ascii=False))


def get_context(chat_id: int) -> dict[str, Any]:
    """Return full context for chat as dict[key]=value (attempt JSON decode)."""
    with SessionLocal() as db:
        rows = (
            db.query(ChatContextKV.key, ChatContextKV.value)
            .filter(ChatContextKV.chat_id == chat_id)
            .all()
        )
    out: dict[str, Any] = {}
    for k, v in rows:
        try:
            out[k] = json.loads(v)
        except Exception:
            out[k] = v
    return out

# tasks per topic -----------------------------------------------------------

def _topic_key(prefix: str, topic: str) -> str:
    return f"{prefix}:{topic.strip()}"


def get_tasks(chat_id: int, topic: str):
    val = _get_value(chat_id, _topic_key("tasks", topic))
    if val is None:
        return None
    try:
        return json.loads(val)
    except Exception:
        return val


def set_tasks(chat_id: int, topic: str, tasks):
    _set_value(chat_id, _topic_key("tasks", topic), _to_json(tasks))

# topic trajectory ----------------------------------------------------------

def get_topic_trajectory(chat_id: int, topic: str):
    val = _get_value(chat_id, _topic_key("topic_traj", topic))
    if val is None:
        return None
    try:
        return json.loads(val)
    except Exception:
        return val


def set_topic_trajectory(chat_id: int, topic: str, payload):
    _set_value(chat_id, _topic_key("topic_traj", topic), _to_json(payload))
