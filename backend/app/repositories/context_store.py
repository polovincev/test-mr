from __future__ import annotations

from typing import Any, Dict, Optional


_context_by_chat_id: Dict[int, Dict[str, Any]] = {}


def upsert_goal(chat_id: int, goal_text: str) -> None:
    ctx = _context_by_chat_id.setdefault(chat_id, {})
    ctx["goal"] = str(goal_text).strip()


def upsert_profile(chat_id: int, profile: dict) -> None:
    ctx = _context_by_chat_id.setdefault(chat_id, {})
    ctx["profile"] = profile


def get_context(chat_id: int) -> Dict[str, Any]:
    return _context_by_chat_id.get(chat_id, {})


# Trajectory helpers
def get_trajectory(chat_id: int):
    return _context_by_chat_id.get(chat_id, {}).get("trajectory")


def set_trajectory(chat_id: int, trajectory):
    ctx = _context_by_chat_id.setdefault(chat_id, {})
    ctx["trajectory"] = trajectory


def get_tasks(chat_id: int, topic: str) -> Any:
    ctx = _context_by_chat_id.get(chat_id, {})
    tasks_by_topic = ctx.get("tasks") or {}
    if isinstance(tasks_by_topic, dict):
        return tasks_by_topic.get(str(topic).strip())
    return None


def set_tasks(chat_id: int, topic: str, tasks: Any) -> None:
    ctx = _context_by_chat_id.setdefault(chat_id, {})
    tasks_by_topic = ctx.setdefault("tasks", {})
    if isinstance(tasks_by_topic, dict):
        tasks_by_topic[str(topic).strip()] = tasks

